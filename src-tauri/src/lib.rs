use serde::{Deserialize, Serialize};
#[cfg(debug_assertions)]
use std::process::{Command, Stdio};
use std::{
    env, fs,
    net::{IpAddr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::Child,
    str::FromStr,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionInfo {
    host: String,
    port: u16,
    #[serde(alias = "base_url")]
    base_url: String,
    token: String,
    #[serde(alias = "health_url")]
    health_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendStatus {
    running: bool,
    pid: Option<u32>,
    base_url: Option<String>,
    token: Option<String>,
    health_url: Option<String>,
    connection_file: Option<String>,
    jobs_dir: Option<String>,
    error: Option<String>,
}

enum BackendChild {
    #[cfg_attr(not(debug_assertions), allow(dead_code))]
    Python(Child),
    Packaged {
        child: Option<CommandChild>,
        running: Arc<AtomicBool>,
        termination: Arc<Mutex<Option<String>>>,
    },
}

impl BackendChild {
    fn pid(&self) -> u32 {
        match self {
            Self::Python(child) => child.id(),
            Self::Packaged { child, .. } => child.as_ref().map(CommandChild::pid).unwrap_or(0),
        }
    }

    fn is_running(&mut self) -> Result<bool, String> {
        match self {
            Self::Python(child) => child
                .try_wait()
                .map(|status| status.is_none())
                .map_err(|error| format!("Impossible de vérifier le backend Python : {error}")),
            Self::Packaged { running, .. } => Ok(running.load(Ordering::SeqCst)),
        }
    }

    fn termination_message(&self) -> Option<String> {
        match self {
            Self::Python(_) => None,
            Self::Packaged { termination, .. } => {
                termination.lock().ok().and_then(|value| value.clone())
            }
        }
    }

    fn kill(&mut self) -> Result<(), String> {
        match self {
            Self::Python(child) => {
                child
                    .kill()
                    .map_err(|error| format!("Impossible d'arrêter le backend Python : {error}"))?;

                let _ = child.wait();
                Ok(())
            }
            Self::Packaged { child, running, .. } => {
                if let Some(child) = child.take() {
                    child
                        .kill()
                        .map_err(|error| format!("Impossible d'arrêter le sidecar : {error}"))?;
                }

                running.store(false, Ordering::SeqCst);
                Ok(())
            }
        }
    }
}

struct BackendProcess {
    child: BackendChild,
    connection: ConnectionInfo,
    connection_file: PathBuf,
    jobs_dir: PathBuf,
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = fs::remove_file(&self.connection_file);
    }
}

#[derive(Default)]
struct PipelineBackendState {
    process: Mutex<Option<BackendProcess>>,
}

#[cfg_attr(not(debug_assertions), allow(dead_code))]
fn find_pipeline_directory() -> Result<PathBuf, String> {
    if let Ok(configured_directory) = env::var("PIPELINE_BACKEND_DIR") {
        let directory = PathBuf::from(configured_directory)
            .canonicalize()
            .map_err(|error| format!("Dossier PIPELINE_BACKEND_DIR invalide : {error}"))?;

        return Ok(directory);
    }

    let current_directory = env::current_dir()
        .map_err(|error| format!("Impossible de déterminer le dossier courant : {error}"))?;

    for ancestor in current_directory.ancestors() {
        let candidate = ancestor.join("pipeline_identification_ms");

        let main_file = candidate.join("main.py");
        let api_file = candidate.join("api").join("sidecar.py");

        if main_file.is_file() && api_file.is_file() {
            return candidate.canonicalize().map_err(|error| {
                format!("Impossible de résoudre {} : {error}", candidate.display())
            });
        }
    }

    Err(format!(
        "Moteur Python introuvable depuis {}.          Définissez PIPELINE_BACKEND_DIR si nécessaire.",
        current_directory.display()
    ))
}

#[cfg_attr(not(debug_assertions), allow(dead_code))]
fn find_python_executable(pipeline_directory: &Path) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let executable = pipeline_directory
        .join(".venv")
        .join("Scripts")
        .join("python.exe");

    #[cfg(not(target_os = "windows"))]
    let executable = pipeline_directory.join(".venv").join("bin").join("python");

    if !executable.is_file() {
        return Err(format!(
            "Interpréteur Python du moteur introuvable : {}",
            executable.display()
        ));
    }

    Ok(executable)
}

fn wait_for_connection_file(
    connection_file: &Path,
    child: &mut BackendChild,
) -> Result<ConnectionInfo, String> {
    for _ in 0..600 {
        if !child.is_running()? {
            return Err(child.termination_message().unwrap_or_else(|| {
                "Le backend s'est arrêté avant de produire son fichier de connexion.".to_string()
            }));
        }

        if connection_file.is_file() {
            let content = fs::read_to_string(connection_file).map_err(|error| {
                format!("Impossible de lire {} : {error}", connection_file.display())
            })?;

            return serde_json::from_str(&content)
                .map_err(|error| format!("Fichier de connexion JSON invalide : {error}"));
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err("Le backend n'a pas produit son fichier de connexion sous 60 secondes.".to_string())
}

fn wait_for_backend_ready(
    connection: &ConnectionInfo,
    child: &mut BackendChild,
) -> Result<(), String> {
    let ip_address = IpAddr::from_str(&connection.host)
        .map_err(|error| format!("Adresse du backend invalide {} : {error}", connection.host))?;

    let socket_address = SocketAddr::new(ip_address, connection.port);

    for _ in 0..600 {
        if !child.is_running()? {
            return Err(child
                .termination_message()
                .unwrap_or_else(|| "Le backend s'est arrêté avant d'être prêt.".to_string()));
        }

        if TcpStream::connect_timeout(&socket_address, Duration::from_millis(100)).is_ok() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err(format!(
        "Le backend n'écoute pas sur {} après 60 secondes.",
        socket_address
    ))
}

fn spawn_packaged_backend(
    app: &tauri::AppHandle,
    connection_file: &Path,
    jobs_directory: &Path,
) -> Result<BackendChild, String> {
    let command = app
        .shell()
        .sidecar("pipeline-api-sidecar")
        .map_err(|error| format!("Sidecar empaqueté indisponible : {error}"))?
        .args([
            "--connection-file",
            &connection_file.display().to_string(),
            "--jobs-dir",
            &jobs_directory.display().to_string(),
        ])
        .set_process_group(true)
        .kill_on_drop(true);

    let (mut events, child) = command
        .spawn()
        .map_err(|error| format!("Impossible de démarrer le sidecar empaqueté : {error}"))?;

    let running = Arc::new(AtomicBool::new(true));
    let termination = Arc::new(Mutex::new(None::<String>));

    let event_running = Arc::clone(&running);
    let event_termination = Arc::clone(&termination);

    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(output) => {
                    let text = String::from_utf8_lossy(&output);

                    if !text.trim().is_empty() {
                        println!("[pipeline-api] {}", text.trim());
                    }
                }
                CommandEvent::Stderr(output) => {
                    let text = String::from_utf8_lossy(&output);

                    if !text.trim().is_empty() {
                        eprintln!("[pipeline-api] {}", text.trim());
                    }
                }
                CommandEvent::Error(error) => {
                    if let Ok(mut message) = event_termination.lock() {
                        *message = Some(format!("Erreur du sidecar : {error}"));
                    }

                    event_running.store(false, Ordering::SeqCst);
                }
                CommandEvent::Terminated(payload) => {
                    let message = format!(
                        "Le sidecar s'est arrêté avec le code {:?} et le signal {:?}.",
                        payload.code, payload.signal,
                    );

                    if let Ok(mut stored_message) = event_termination.lock() {
                        *stored_message = Some(message);
                    }

                    event_running.store(false, Ordering::SeqCst);
                }
                _ => {}
            }
        }

        event_running.store(false, Ordering::SeqCst);
    });

    Ok(BackendChild::Packaged {
        child: Some(child),
        running,
        termination,
    })
}

#[cfg(debug_assertions)]
fn spawn_python_backend(
    connection_file: &Path,
    jobs_directory: &Path,
) -> Result<BackendChild, String> {
    let pipeline_directory = find_pipeline_directory()?;
    let python_executable = find_python_executable(&pipeline_directory)?;

    let child = Command::new(&python_executable)
        .current_dir(&pipeline_directory)
        .arg("-m")
        .arg("api.sidecar")
        .arg("--connection-file")
        .arg(connection_file)
        .arg("--jobs-dir")
        .arg(jobs_directory)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| format!("Impossible de démarrer le backend Python : {error}"))?;

    Ok(BackendChild::Python(child))
}

fn spawn_pipeline_backend(
    app: &tauri::AppHandle,
    connection_file: &Path,
    jobs_directory: &Path,
) -> Result<BackendChild, String> {
    match spawn_packaged_backend(app, connection_file, jobs_directory) {
        Ok(child) => Ok(child),
        Err(packaged_error) => {
            #[cfg(debug_assertions)]
            {
                eprintln!(
                    "Sidecar empaqueté indisponible, utilisation du runtime Python : {}",
                    packaged_error,
                );

                spawn_python_backend(connection_file, jobs_directory)
            }

            #[cfg(not(debug_assertions))]
            {
                Err(packaged_error)
            }
        }
    }
}

fn process_to_status(process: &BackendProcess) -> BackendStatus {
    BackendStatus {
        running: true,
        pid: Some(process.child.pid()),
        base_url: Some(process.connection.base_url.clone()),
        token: Some(process.connection.token.clone()),
        health_url: Some(process.connection.health_url.clone()),
        connection_file: Some(process.connection_file.display().to_string()),
        jobs_dir: Some(process.jobs_dir.display().to_string()),
        error: None,
    }
}

#[tauri::command]
fn start_pipeline_backend(
    app: tauri::AppHandle,
    state: tauri::State<'_, PipelineBackendState>,
) -> Result<BackendStatus, String> {
    let mut process_guard = state
        .process
        .lock()
        .map_err(|_| "État du backend local inaccessible.".to_string())?;

    if let Some(process) = process_guard.as_mut() {
        if process.child.is_running()? {
            return Ok(process_to_status(process));
        }

        *process_guard = None;
    }

    let application_data_directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Dossier local de l'application indisponible : {error}"))?;

    let runtime_directory = application_data_directory.join("runtime");
    let jobs_directory = application_data_directory.join("jobs");
    let connection_file = runtime_directory.join("pipeline-api.json");

    fs::create_dir_all(&runtime_directory).map_err(|error| {
        format!(
            "Impossible de créer {} : {error}",
            runtime_directory.display()
        )
    })?;

    fs::create_dir_all(&jobs_directory)
        .map_err(|error| format!("Impossible de créer {} : {error}", jobs_directory.display()))?;

    if connection_file.exists() {
        fs::remove_file(&connection_file)
            .map_err(|error| format!("Impossible de supprimer l'ancienne connexion : {error}"))?;
    }

    let mut child = spawn_pipeline_backend(&app, &connection_file, &jobs_directory)?;

    let connection = match wait_for_connection_file(&connection_file, &mut child) {
        Ok(connection) => connection,
        Err(error) => {
            let _ = child.kill();
            return Err(error);
        }
    };

    if let Err(error) = wait_for_backend_ready(&connection, &mut child) {
        let _ = child.kill();
        let _ = fs::remove_file(&connection_file);
        return Err(error);
    }

    let process = BackendProcess {
        child,
        connection,
        connection_file,
        jobs_dir: jobs_directory,
    };

    let status = process_to_status(&process);
    *process_guard = Some(process);

    Ok(status)
}

#[tauri::command]
fn get_pipeline_backend_status(
    state: tauri::State<'_, PipelineBackendState>,
) -> Result<BackendStatus, String> {
    let mut process_guard = state
        .process
        .lock()
        .map_err(|_| "État du backend local inaccessible.".to_string())?;

    let Some(process) = process_guard.as_mut() else {
        return Ok(BackendStatus {
            running: false,
            pid: None,
            base_url: None,
            token: None,
            health_url: None,
            connection_file: None,
            jobs_dir: None,
            error: None,
        });
    };

    if process.child.is_running()? {
        return Ok(process_to_status(process));
    }

    let error = process
        .child
        .termination_message()
        .unwrap_or_else(|| "Le backend local s'est arrêté.".to_string());

    *process_guard = None;

    Ok(BackendStatus {
        running: false,
        pid: None,
        base_url: None,
        token: None,
        health_url: None,
        connection_file: None,
        jobs_dir: None,
        error: Some(error),
    })
}

#[tauri::command]
fn stop_pipeline_backend(
    state: tauri::State<'_, PipelineBackendState>,
) -> Result<BackendStatus, String> {
    let mut process_guard = state
        .process
        .lock()
        .map_err(|_| "État du backend local inaccessible.".to_string())?;

    if let Some(mut process) = process_guard.take() {
        process.child.kill()?;
        let _ = fs::remove_file(&process.connection_file);
    }

    Ok(BackendStatus {
        running: false,
        pid: None,
        base_url: None,
        token: None,
        health_url: None,
        connection_file: None,
        jobs_dir: None,
        error: None,
    })
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct UploadedPipelineFile {
    destination: String,
    filename: String,
    size_bytes: u64,
    relative_path: String,
}

fn validate_upload_destination(destination: &str) -> Result<(), String> {
    match destination {
        "samples" | "blanks" | "calibration" | "databases" => Ok(()),
        _ => Err(format!("Destination de fichier interdite : {destination}")),
    }
}

#[tauri::command]
async fn upload_pipeline_file(
    state: tauri::State<'_, PipelineBackendState>,
    job_id: String,
    destination: String,
    file_path: String,
) -> Result<UploadedPipelineFile, String> {
    validate_upload_destination(&destination)?;

    if job_id.trim().is_empty() {
        return Err("L'identifiant du job est vide.".to_string());
    }

    let local_file = PathBuf::from(&file_path)
        .canonicalize()
        .map_err(|error| format!("Fichier local introuvable {file_path} : {error}"))?;

    if !local_file.is_file() {
        return Err(format!(
            "Le chemin sélectionné n'est pas un fichier : {}",
            local_file.display()
        ));
    }

    let filename = local_file
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Le nom du fichier n'est pas valide.".to_string())?
        .to_string();

    let file_size = tokio::fs::metadata(&local_file)
        .await
        .map_err(|error| {
            format!(
                "Impossible de lire les métadonnées de {} : \
                 {error}",
                local_file.display()
            )
        })?
        .len();

    // Copier les informations de connexion et libérer le
    // Mutex avant toute opération réseau asynchrone.
    let connection = {
        let mut process_guard = state
            .process
            .lock()
            .map_err(|_| "État du backend local inaccessible.".to_string())?;

        let process = process_guard
            .as_mut()
            .ok_or_else(|| "Le moteur local n'est pas démarré.".to_string())?;

        if !process.child.is_running()? {
            return Err(process
                .child
                .termination_message()
                .unwrap_or_else(|| "Le moteur local s'est arrêté.".to_string()));
        }

        process.connection.clone()
    };

    let file_part = reqwest::multipart::Part::file(&local_file)
        .await
        .map_err(|error| {
            format!(
                "Impossible d'ouvrir {} pour l'upload : \
             {error}",
                local_file.display()
            )
        })?
        .file_name(filename.clone())
        .mime_str("application/octet-stream")
        .map_err(|error| format!("Type multipart invalide : {error}"))?;

    let form = reqwest::multipart::Form::new()
        .text("destination", destination)
        .part("uploaded_file", file_part);

    let url = format!("{}/api/v1/jobs/{}/files", connection.base_url, job_id,);

    let response = reqwest::Client::new()
        .post(url)
        .bearer_auth(&connection.token)
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("Échec du transfert de {filename} : {error}"))?;

    let response_status = response.status();

    if !response_status.is_success() {
        let response_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Réponse API illisible.".to_string());

        return Err(format!(
            "Upload refusé pour {filename} \
             ({response_status}) : {response_text}"
        ));
    }

    let uploaded = response
        .json::<UploadedPipelineFile>()
        .await
        .map_err(|error| {
            format!(
                "Réponse d'upload invalide pour \
                 {filename} : {error}"
            )
        })?;

    if uploaded.size_bytes != file_size {
        return Err(format!(
            "Taille incohérente après l'upload de \
             {filename} : local={file_size}, distant={}",
            uploaded.size_bytes
        ));
    }

    Ok(uploaded)
}

fn resolve_local_job_file(
    state: &tauri::State<'_, PipelineBackendState>,
    job_id: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    if job_id.trim().is_empty() {
        return Err("L'identifiant du job est vide.".to_string());
    }

    let relative_file = PathBuf::from(relative_path);

    if relative_file.is_absolute()
        || relative_file.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir
                    | std::path::Component::CurDir
                    | std::path::Component::RootDir
                    | std::path::Component::Prefix(_)
            )
        })
    {
        return Err("Chemin de fichier du job invalide.".to_string());
    }

    let jobs_directory = {
        let process_guard = state
            .process
            .lock()
            .map_err(|_| "État du backend local inaccessible.".to_string())?;

        let process = process_guard
            .as_ref()
            .ok_or_else(|| "Le moteur local n'est pas démarré.".to_string())?;

        process.jobs_dir.clone()
    };

    let job_directory = jobs_directory
        .join(job_id)
        .canonicalize()
        .map_err(|error| format!("Dossier du job {job_id} introuvable : {error}"))?;

    let target_file = job_directory
        .join(&relative_file)
        .canonicalize()
        .map_err(|error| format!("Fichier {} introuvable : {error}", relative_path))?;

    if !target_file.starts_with(&job_directory) {
        return Err("Le fichier demandé sort du dossier du job.".to_string());
    }

    if !target_file.is_file() {
        return Err(format!(
            "Le chemin demandé n'est pas un fichier : {}",
            target_file.display()
        ));
    }

    if target_file
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(".uploading"))
    {
        return Err("Un fichier temporaire ne peut pas être ouvert.".to_string());
    }

    Ok(target_file)
}

#[tauri::command]
fn open_pipeline_file(
    app: tauri::AppHandle,
    state: tauri::State<'_, PipelineBackendState>,
    job_id: String,
    relative_path: String,
) -> Result<(), String> {
    let target_file = resolve_local_job_file(&state, &job_id, &relative_path)?;

    let target_path = target_file.to_string_lossy().into_owned();

    app.opener()
        .open_path(target_path, None::<&str>)
        .map_err(|error| format!("Impossible d'ouvrir le fichier : {error}"))
}

#[tauri::command]
async fn export_pipeline_file(
    state: tauri::State<'_, PipelineBackendState>,
    job_id: String,
    relative_path: String,
    destination_path: String,
) -> Result<u64, String> {
    let source_file = resolve_local_job_file(&state, &job_id, &relative_path)?;

    let destination_file = PathBuf::from(destination_path);

    if destination_file.as_os_str().is_empty() {
        return Err("La destination d'export est vide.".to_string());
    }

    if let Some(parent_directory) = destination_file.parent() {
        tokio::fs::create_dir_all(parent_directory)
            .await
            .map_err(|error| {
                format!(
                    "Impossible de créer le dossier \
                     d'export {} : {error}",
                    parent_directory.display()
                )
            })?;
    }

    let temporary_file = destination_file.with_extension(format!(
        "{}.exporting",
        destination_file
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
    ));

    let copy_result = tokio::fs::copy(&source_file, &temporary_file).await;

    let copied_bytes = match copy_result {
        Ok(copied_bytes) => copied_bytes,
        Err(error) => {
            let _ = tokio::fs::remove_file(&temporary_file).await;

            return Err(format!(
                "Impossible d'exporter {} : {error}",
                source_file.display()
            ));
        }
    };

    if destination_file.exists() {
        tokio::fs::remove_file(&destination_file)
            .await
            .map_err(|error| {
                format!(
                    "Impossible de remplacer {} : {error}",
                    destination_file.display()
                )
            })?;
    }

    tokio::fs::rename(&temporary_file, &destination_file)
        .await
        .map_err(|error| {
            format!(
                "Impossible de finaliser l'export vers {} : \
             {error}",
                destination_file.display()
            )
        })?;

    Ok(copied_bytes)
}

fn shutdown_pipeline_backend(app: &tauri::AppHandle) {
    let state = app.state::<PipelineBackendState>();

    let Ok(mut process_guard) = state.process.lock() else {
        return;
    };

    if let Some(mut process) = process_guard.take() {
        let _ = process.child.kill();
        let _ = fs::remove_file(&process.connection_file);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PipelineBackendState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_pipeline_backend,
            get_pipeline_backend_status,
            stop_pipeline_backend,
            upload_pipeline_file,
            open_pipeline_file,
            export_pipeline_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Destroyed,
            ..
        } if label == "main" => {
            shutdown_pipeline_backend(app_handle);
            app_handle.exit(0);
        }
        tauri::RunEvent::ExitRequested { .. } => {
            shutdown_pipeline_backend(app_handle);
        }
        _ => {}
    });
}
