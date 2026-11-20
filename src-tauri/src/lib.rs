use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    net::{IpAddr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    str::FromStr,
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

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

struct BackendProcess {
    child: Child,
    connection: ConnectionInfo,
    connection_file: PathBuf,
    jobs_dir: PathBuf,
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = fs::remove_file(&self.connection_file);
    }
}

#[derive(Default)]
struct PipelineBackendState {
    process: Mutex<Option<BackendProcess>>,
}

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
    child: &mut Child,
) -> Result<ConnectionInfo, String> {
    for _ in 0..100 {
        if let Some(exit_status) = child
            .try_wait()
            .map_err(|error| format!("Impossible de vérifier le processus Python : {error}"))?
        {
            return Err(format!(
                "Le backend Python s'est arrêté prématurément : \
                 {exit_status}"
            ));
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

    Err(
        "Le backend Python n'a pas produit son fichier de connexion \
         sous 10 secondes."
            .to_string(),
    )
}

fn wait_for_backend_ready(connection: &ConnectionInfo, child: &mut Child) -> Result<(), String> {
    let ip_address = IpAddr::from_str(&connection.host)
        .map_err(|error| format!("Adresse du backend invalide {} : {error}", connection.host))?;

    let socket_address = SocketAddr::new(ip_address, connection.port);

    for _ in 0..100 {
        if let Some(exit_status) = child
            .try_wait()
            .map_err(|error| format!("Impossible de vérifier le backend : {error}"))?
        {
            return Err(format!(
                "Le backend Python s'est arrêté prématurément :                  {exit_status}"
            ));
        }

        if TcpStream::connect_timeout(&socket_address, Duration::from_millis(100)).is_ok() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err(format!(
        "Le backend n'écoute pas sur {} après 10 secondes.",
        socket_address
    ))
}

fn process_to_status(process: &BackendProcess) -> BackendStatus {
    BackendStatus {
        running: true,
        pid: Some(process.child.id()),
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
        if process
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            return Ok(process_to_status(process));
        }

        *process_guard = None;
    }

    let pipeline_directory = find_pipeline_directory()?;
    let python_executable = find_python_executable(&pipeline_directory)?;

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

    let mut child = Command::new(&python_executable)
        .current_dir(&pipeline_directory)
        .arg("-m")
        .arg("api.sidecar")
        .arg("--connection-file")
        .arg(&connection_file)
        .arg("--jobs-dir")
        .arg(&jobs_directory)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| format!("Impossible de démarrer le backend Python : {error}"))?;

    let connection = match wait_for_connection_file(&connection_file, &mut child) {
        Ok(connection) => connection,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
    };

    if let Err(error) = wait_for_backend_ready(&connection, &mut child) {
        let _ = child.kill();
        let _ = child.wait();
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

    match process.child.try_wait() {
        Ok(None) => Ok(process_to_status(process)),
        Ok(Some(exit_status)) => {
            let error = format!("Le backend s'est arrêté avec le statut {exit_status}.");

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
        Err(error) => Err(format!("Impossible de vérifier le backend : {error}")),
    }
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
        process
            .child
            .kill()
            .map_err(|error| format!("Impossible d'arrêter le backend Python : {error}"))?;

        let _ = process.child.wait();
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

        if process
            .child
            .try_wait()
            .map_err(|error| {
                format!(
                    "Impossible de vérifier le backend : \
                     {error}"
                )
            })?
            .is_some()
        {
            return Err("Le moteur local s'est arrêté.".to_string());
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
