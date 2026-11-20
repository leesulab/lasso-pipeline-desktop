import { useEffect, useMemo, useState } from "react";
import {
  getBackendStatus,
  startBackend,
  stopBackend,
  stoppedBackendStatus,
  type BackendStatus,
} from "./backend";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  FolderOpen,
  Play,
  RefreshCw,
  Server,
  UploadCloud,
} from "lucide-react";
import {
  createPipelineJob,
  fetchPipelineJob,
  runPipelineJob,
} from "./api";
import { usePipelineData } from "./usePipelineData";
import {
  uploadSelectedPipelineFiles,
  type UploadProgress,
} from "./uploadSelectedFiles";
import {
  emptySelectedFiles,
  getFileName,
  selectBlankFiles,
  selectCalibrationFile,
  selectDatabaseFile,
  selectSampleFiles,
  type SelectedPipelineFiles,
} from "./fileSelection";
import "./App.css";

type JobStatus =
  | "created"
  | "success"
  | "running"
  | "error";
type View = "overview" | "new" | "jobs" | "results";

const navigation = [
  {
    id: "overview" as const,
    label: "Vue d’ensemble",
    icon: Activity,
  },
  {
    id: "new" as const,
    label: "Nouvelle analyse",
    icon: UploadCloud,
  },
  {
    id: "jobs" as const,
    label: "Analyses récentes",
    icon: Clock3,
  },
  {
    id: "results" as const,
    label: "Résultats",
    icon: Database,
  },
];

function StatusBadge({ status }: { status: JobStatus }) {
  const labels: Record<JobStatus, string> = {
    created: "Créé",
    success: "Terminé",
    running: "En cours",
    error: "Erreur",
  };

  return (
    <span className={`status-badge status-${status}`}>
      {labels[status]}
    </span>
  );
}

function ProgressBar({
  value,
  error = false,
}: {
  value: number;
  error?: boolean;
}) {
  return (
    <div className="progress-track">
      <div
        className={`progress-value ${error ? "progress-error" : ""}`}
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
        }}
      />
    </div>
  );
}

function App() {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>(stoppedBackendStatus);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendActionPending, setBackendActionPending] =
    useState(false);
  const {
    steps: pipelineSteps,
    jobs,
    loading: pipelineDataLoading,
    error: pipelineDataError,
    refresh: refreshPipelineData,
  } = usePipelineData(backendStatus);

  const [selectedSteps, setSelectedSteps] =
    useState<string[]>([]);
  const [projectName, setProjectName] = useState(
    "Nouvelle analyse locale",
  );
  const [selectedFiles, setSelectedFiles] =
    useState<SelectedPipelineFiles>(
      emptySelectedFiles,
    );
  const [fileSelectionError, setFileSelectionError] =
    useState<string | null>(null);
  const [jobActionPending, setJobActionPending] =
    useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgress | null>(null);
  const [jobActionError, setJobActionError] =
    useState<string | null>(null);
  const [view, setView] = useState<View>("overview");

  const runningJobs = useMemo(
    () => jobs.filter((job) => job.status === "running").length,
    [jobs],
  );

  const engineStarted = backendStatus.running;

  useEffect(() => {
    if (
      pipelineSteps.length > 0 &&
      selectedSteps.length === 0
    ) {
      setSelectedSteps(
        pipelineSteps.map((step) => step.id),
      );
    }
  }, [pipelineSteps, selectedSteps.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendStatus() {
      try {
        const status = await getBackendStatus();

        if (!cancelled) {
          setBackendStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendStatus({
            ...stoppedBackendStatus,
            error: String(error),
          });
        }
      } finally {
        if (!cancelled) {
          setBackendLoading(false);
        }
      }
    }

    void loadBackendStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleBackend() {
    if (backendActionPending) {
      return;
    }

    setBackendActionPending(true);

    try {
      const status = backendStatus.running
        ? await stopBackend()
        : await startBackend();

      setBackendStatus(status);
    } catch (error) {
      setBackendStatus((current) => ({
        ...current,
        error: String(error),
      }));
    } finally {
      setBackendActionPending(false);
      setBackendLoading(false);
    }
  }

  async function chooseCalibrationFile() {
    setFileSelectionError(null);

    try {
      const calibration =
        await selectCalibrationFile();

      if (calibration) {
        setSelectedFiles((current) => ({
          ...current,
          calibration,
        }));
      }
    } catch (error) {
      setFileSelectionError(String(error));
    }
  }

  async function chooseDatabaseFile() {
    setFileSelectionError(null);

    try {
      const database = await selectDatabaseFile();

      if (database) {
        setSelectedFiles((current) => ({
          ...current,
          database,
        }));
      }
    } catch (error) {
      setFileSelectionError(String(error));
    }
  }

  async function chooseBlankFiles() {
    setFileSelectionError(null);

    try {
      const blanks = await selectBlankFiles();

      if (blanks.length > 0) {
        setSelectedFiles((current) => ({
          ...current,
          blanks,
        }));
      }
    } catch (error) {
      setFileSelectionError(String(error));
    }
  }

  async function chooseSampleFiles() {
    setFileSelectionError(null);

    try {
      const samples = await selectSampleFiles();

      if (samples.length > 0) {
        setSelectedFiles((current) => ({
          ...current,
          samples,
        }));
      }
    } catch (error) {
      setFileSelectionError(String(error));
    }
  }

  async function createAndRunJob() {
    if (
      !backendStatus.running ||
      selectedSteps.length === 0 ||
      jobActionPending
    ) {
      return;
    }

    setJobActionPending(true);
    setJobActionError(null);

    try {
      const createdJob = await createPipelineJob(
        backendStatus,
        selectedSteps,
        projectName.trim() || "Analyse locale",
      );

      await refreshPipelineData();
      setView("jobs");

      await uploadSelectedPipelineFiles(
        createdJob.jobId,
        selectedFiles,
        setUploadProgress,
      );

      await runPipelineJob(
        backendStatus,
        createdJob.jobId,
      );

      const pollingDeadline = Date.now() + 60_000;

      while (Date.now() < pollingDeadline) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 500);
        });

        const job = await fetchPipelineJob(
          backendStatus,
          createdJob.jobId,
        );

        await refreshPipelineData();

        if (
          job.status === "success" ||
          job.status === "error"
        ) {
          if (job.status === "error") {
            throw new Error(
              job.error?.message ??
                "La pipeline s'est terminée en erreur.",
            );
          }

          return;
        }
      }

      throw new Error(
        "Le suivi du job a dépassé 60 secondes.",
      );
    } catch (error) {
      setJobActionError(String(error));
      await refreshPipelineData();
    } finally {
      setUploadProgress(null);
      setJobActionPending(false);
    }
  }

  function toggleStep(stepId: string) {
    setSelectedSteps((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId],
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-icon">
              <Activity size={26} />
            </div>

            <div>
              <h1>LASSO Pipeline Desktop</h1>
              <p>
                Analyse HRMS locale, persistante et sécurisée
              </p>
            </div>
          </div>

          <div className="engine-actions">
            <div
              className={`engine-status ${
                engineStarted
                  ? "engine-online"
                  : "engine-offline"
              }`}
            >
              <span className="engine-dot" />
              {backendLoading
                ? "Vérification du moteur…"
                : engineStarted
                  ? "Moteur local actif"
                  : "Moteur arrêté"}
            </div>

            <button
              className="button button-secondary"
              onClick={() => void toggleBackend()}
              disabled={
                backendLoading || backendActionPending
              }
            >
              <Server size={17} />
              {backendActionPending
                ? "Veuillez patienter…"
                : engineStarted
                  ? "Arrêter"
                  : "Démarrer"}
            </button>
          </div>
        </div>
      </header>

      {backendStatus.error && (
        <div className="backend-error-panel">
          <strong>Échec du démarrage du moteur</strong>
          <span>{backendStatus.error}</span>
        </div>
      )}

      {engineStarted && (
        <div className="pipeline-data-toolbar">
          <span>
            {pipelineDataLoading
              ? "Chargement des données du moteur…"
              : `${pipelineSteps.length} étapes · ${jobs.length} analyses`}
          </span>

          <button
            className="refresh-data-button"
            onClick={() => void refreshPipelineData()}
            disabled={pipelineDataLoading}
          >
            <RefreshCw
              size={14}
              className={
                pipelineDataLoading ? "icon-spinning" : ""
              }
            />
            Actualiser
          </button>
        </div>
      )}

      {pipelineDataError && (
        <div className="backend-error-panel">
          <strong>Impossible de charger les données</strong>
          <span>{pipelineDataError}</span>
        </div>
      )}

      {jobActionError && (
        <div className="backend-error-panel">
          <strong>Échec de l’analyse</strong>
          <span>{jobActionError}</span>
        </div>
      )}

      <div className="application-layout">
        <aside className="sidebar">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`navigation-item ${
                  view === item.id
                    ? "navigation-active"
                    : ""
                }`}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </aside>

        <section className="main-content">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {view === "overview" && (
              <>
                <div className="page-heading">
                  <div>
                    <h2>Vue d’ensemble</h2>
                    <p>
                      Suivez le moteur local et reprenez vos
                      analyses.
                    </p>
                  </div>

                  <button
                    className="button button-primary"
                    onClick={() => setView("new")}
                  >
                    <Play size={17} />
                    Nouvelle analyse
                  </button>
                </div>

                <div className="statistics-grid">
                  <article className="card statistic-card">
                    <div>
                      <span>Moteur</span>
                      <strong>
                        {engineStarted
                          ? "Disponible"
                          : "Arrêté"}
                      </strong>
                    </div>
                    <Server />
                  </article>

                  <article className="card statistic-card">
                    <div>
                      <span>Jobs en cours</span>
                      <strong>{runningJobs}</strong>
                    </div>
                    <RefreshCw />
                  </article>

                  <article className="card statistic-card">
                    <div>
                      <span>Analyses conservées</span>
                      <strong>{jobs.length}</strong>
                    </div>
                    <FolderOpen />
                  </article>
                </div>

                <article className="card recent-activity">
                  <div className="card-title">
                    <h3>Activité récente</h3>
                  </div>

                  {jobs.length === 0 && (
                    <div className="empty-state">
                      Aucune analyse persistante.
                    </div>
                  )}

                  {jobs.slice(0, 3).map((job) => (
                    <div
                      className="activity-row"
                      key={job.id}
                    >
                      <div className="job-description">
                        <strong>{job.name}</strong>
                        <span>
                          {job.step} · {job.updated}
                        </span>
                      </div>

                      <div className="job-progress">
                        <div className="progress-label">
                          <span>Progression</span>
                          <span>{job.progress}%</span>
                        </div>

                        <ProgressBar
                          value={job.progress}
                          error={job.status === "error"}
                        />
                      </div>

                      <StatusBadge status={job.status} />
                    </div>
                  ))}
                </article>
              </>
            )}

            {view === "new" && (
              <>
                <div className="page-heading">
                  <div>
                    <h2>Nouvelle analyse</h2>
                    <p>
                      Choisissez les étapes. Le moteur vérifiera
                      leurs prérequis.
                    </p>
                  </div>
                </div>

                <article className="card pipeline-card">
                  <label className="project-field">
                    <span>Nom de l’analyse</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) =>
                        setProjectName(event.target.value)
                      }
                      placeholder="Ex. Campagne Seine · Lot 04"
                    />
                  </label>

                  <h3>Étapes de la pipeline</h3>

                  <div className="steps-grid">
                    {pipelineSteps.map((step, index) => (
                      <label
                        className="step-option"
                        key={step.id}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSteps.includes(
                            step.id,
                          )}
                          onChange={() =>
                            toggleStep(step.id)
                          }
                        />

                        <span className="step-number">
                          {index + 1}
                        </span>

                        <span>{step.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="file-selection-grid">
                    <button
                      type="button"
                      className="file-selection-button"
                      onClick={() =>
                        void chooseCalibrationFile()
                      }
                    >
                      <FolderOpen size={17} />

                      <span>
                        <strong>Calibration CCS</strong>
                        <small>
                          {selectedFiles.calibration
                            ? getFileName(
                                selectedFiles.calibration,
                              )
                            : "Aucun fichier CSV"}
                        </small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="file-selection-button"
                      onClick={() =>
                        void chooseDatabaseFile()
                      }
                    >
                      <Database size={17} />

                      <span>
                        <strong>
                          Base d’identification
                        </strong>
                        <small>
                          {selectedFiles.database
                            ? getFileName(
                                selectedFiles.database,
                              )
                            : "Aucun fichier H5/HDF5"}
                        </small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="file-selection-button"
                      onClick={() =>
                        void chooseBlankFiles()
                      }
                    >
                      <FolderOpen size={17} />

                      <span>
                        <strong>Blanks</strong>
                        <small>
                          {selectedFiles.blanks.length > 0
                            ? `${selectedFiles.blanks.length} fichier(s)`
                            : "Aucun fichier Parquet"}
                        </small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="file-selection-button"
                      onClick={() =>
                        void chooseSampleFiles()
                      }
                    >
                      <UploadCloud size={17} />

                      <span>
                        <strong>Échantillons</strong>
                        <small>
                          {selectedFiles.samples.length > 0
                            ? `${selectedFiles.samples.length} fichier(s)`
                            : "Aucun fichier Parquet"}
                        </small>
                      </span>
                    </button>
                  </div>

                  {fileSelectionError && (
                    <div className="selection-error">
                      {fileSelectionError}
                    </div>
                  )}

                  {uploadProgress &&
                    uploadProgress.total > 0 && (
                      <div className="upload-progress">
                        <div className="progress-label">
                          <span>
                            Transfert des fichiers
                          </span>
                          <span>
                            {uploadProgress.completed}/
                            {uploadProgress.total}
                          </span>
                        </div>

                        <ProgressBar
                          value={
                            uploadProgress.total > 0
                              ? (
                                  uploadProgress.completed /
                                  uploadProgress.total
                                ) * 100
                              : 0
                          }
                        />

                        {uploadProgress.currentFile && (
                          <small>
                            {getFileName(
                              uploadProgress.currentFile,
                            )}
                          </small>
                        )}
                      </div>
                    )}

                  <div className="pipeline-actions">
                    <button
                      className="button button-primary"
                      disabled={
                        !engineStarted ||
                        selectedSteps.length === 0 ||
                        jobActionPending
                      }
                      onClick={() =>
                        void createAndRunJob()
                      }
                    >
                      <Play size={17} />
                      {jobActionPending
                        ? "Analyse en cours…"
                        : "Créer et lancer"}
                    </button>
                  </div>
                </article>
              </>
            )}

            {view === "jobs" && (
              <>
                <div className="page-heading">
                  <div>
                    <h2>Analyses récentes</h2>
                    <p>
                      Les jobs seront restaurés depuis leur état
                      persistant.
                    </p>
                  </div>
                </div>

                <div className="jobs-list">
                  {jobs.length === 0 && (
                    <article className="card empty-state">
                      Aucun job n'a encore été créé.
                    </article>
                  )}

                  {jobs.map((job) => (
                    <article
                      className="card job-card"
                      key={job.id}
                    >
                      <div className="job-description">
                        <strong>{job.name}</strong>
                        <span>
                          ID {job.id} · {job.step}
                        </span>
                      </div>

                      <div className="job-progress">
                        <div className="progress-label">
                          <span>{job.updated}</span>
                          <span>{job.progress}%</span>
                        </div>

                        <ProgressBar
                          value={job.progress}
                          error={job.status === "error"}
                        />
                      </div>

                      <StatusBadge status={job.status} />
                    </article>
                  ))}
                </div>
              </>
            )}

            {view === "results" && (
              <>
                <div className="page-heading">
                  <div>
                    <h2>Résultats</h2>
                    <p>
                      Fichiers produits par les analyses
                      terminées.
                    </p>
                  </div>
                </div>

                <article className="card result-card">
                  <CheckCircle2 size={28} />

                  <div>
                    <strong>
                      Observatoire HRMS · Bougival
                    </strong>
                    <span>
                      features_complete.parquet ·
                      feature_matrix.parquet · 7 visualisations
                      · pipeline.log
                    </span>
                  </div>
                </article>
              </>
            )}
          </motion.div>
        </section>
      </div>
    </main>
  );
}

export default App;
