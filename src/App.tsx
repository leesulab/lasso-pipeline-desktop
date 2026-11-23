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
  runPipelineJob,
} from "./api";
import {
  monitorPipelineJob,
} from "./monitorPipelineJob";
import { usePipelineData } from "./usePipelineData";
import {
  usePipelineConfiguration,
} from "./usePipelineConfiguration";
import {
  PipelineConfigurationPanel,
} from "./PipelineConfigurationPanel";
import {
  formatFileSize,
  getPipelineFileName,
  usePipelineFiles,
} from "./usePipelineFiles";
import {
  exportResultFile,
  openResultFile,
} from "./resultFileActions";
import {
  uploadSelectedPipelineFiles,
  type UploadProgress,
} from "./uploadSelectedFiles";
import {
  validatePipelineSelection,
} from "./validatePipelineSelection";
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
  | "error"
  | "interrupted";
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
    interrupted: "Interrompu",
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

  const {
    schema: pipelineConfigurationSchema,
    configuration: pipelineConfiguration,
    validation: pipelineConfigurationValidation,
    loading: pipelineConfigurationLoading,
    validating: pipelineConfigurationValidating,
    error: pipelineConfigurationError,
    setParameter: setPipelineConfigurationParameter,
    resetParameter: resetPipelineConfigurationParameter,
    resetSection: resetPipelineConfigurationSection,
    resetAll: resetPipelineConfiguration,
    validate: validateCurrentPipelineConfiguration,
  } = usePipelineConfiguration(backendStatus);

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
  const [restartingJobId, setRestartingJobId] =
    useState<string | null>(null);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgress | null>(null);
  const [jobActionError, setJobActionError] =
    useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [selectedResultJobId, setSelectedResultJobId] =
    useState<string | null>(null);
  const [resultActionPending, setResultActionPending] =
    useState<string | null>(null);
  const [resultActionMessage, setResultActionMessage] =
    useState<string | null>(null);
  const [resultActionError, setResultActionError] =
    useState<string | null>(null);

  const selectedResultJob =
    jobs.find(
      (job) =>
        job.source.jobId === selectedResultJobId,
    ) ?? null;

  const {
    files: selectedJobFiles,
    filesByCategory,
    loading: resultFilesLoading,
    error: resultFilesError,
    refresh: refreshResultFiles,
  } = usePipelineFiles(
    backendStatus,
    selectedResultJobId,
  );

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

  async function handleOpenResultFile(
    relativePath: string,
  ) {
    if (!selectedResultJobId || resultActionPending) {
      return;
    }

    const actionKey = `open:${relativePath}`;

    setResultActionPending(actionKey);
    setResultActionMessage(null);
    setResultActionError(null);

    try {
      await openResultFile(
        selectedResultJobId,
        relativePath,
      );

      setResultActionMessage(
        `Fichier ouvert : ${getPipelineFileName(
          relativePath,
        )}`,
      );
    } catch (error) {
      setResultActionError(String(error));
    } finally {
      setResultActionPending(null);
    }
  }

  async function handleExportResultFile(
    relativePath: string,
  ) {
    if (!selectedResultJobId || resultActionPending) {
      return;
    }

    const filename = getPipelineFileName(relativePath);
    const actionKey = `export:${relativePath}`;

    setResultActionPending(actionKey);
    setResultActionMessage(null);
    setResultActionError(null);

    try {
      const exportedBytes = await exportResultFile(
        selectedResultJobId,
        relativePath,
        filename,
      );

      if (exportedBytes !== null) {
        setResultActionMessage(
          `${filename} exporté avec succès ` +
            `(${formatFileSize(exportedBytes)}).`,
        );
      }
    } catch (error) {
      setResultActionError(String(error));
    } finally {
      setResultActionPending(null);
    }
  }

  function showJobResults(jobId: string) {
    setSelectedResultJobId(jobId);
    setView("results");
  }

  async function restartJob(jobId: string) {
    if (
      !backendStatus.running ||
      restartingJobId !== null
    ) {
      return;
    }

    setRestartingJobId(jobId);
    setJobActionError(null);

    try {
      await runPipelineJob(
        backendStatus,
        jobId,
      );

      await refreshPipelineData();

      await monitorPipelineJob(
        backendStatus,
        jobId,
        {
          pollingIntervalMs: 1_000,
          onUpdate: async () => {
            await refreshPipelineData();
          },
        },
      );

      await refreshPipelineData();
    } catch (error) {
      setJobActionError(String(error));
      await refreshPipelineData();
    } finally {
      setRestartingJobId(null);
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

    const validationErrors =
      validatePipelineSelection(
        selectedSteps,
        selectedFiles,
      );

    if (validationErrors.length > 0) {
      setJobActionError(
        validationErrors.join(" "),
      );
      return;
    }

    setJobActionPending(true);
    setJobActionError(null);

    try {
      const configurationValidation =
        await validateCurrentPipelineConfiguration();

      if (!configurationValidation.valid) {
        setJobActionError(
          "La configuration de la pipeline contient " +
            "des erreurs. Corrigez les paramètres " +
            "signalés avant de lancer l’analyse.",
        );
        setView("new");
        return;
      }

      const createdJob = await createPipelineJob(
        backendStatus,
        selectedSteps,
        projectName.trim() || "Analyse locale",
        configurationValidation.configuration,
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

      await monitorPipelineJob(
        backendStatus,
        createdJob.jobId,
        {
          pollingIntervalMs: 1_000,
          onUpdate: async () => {
            await refreshPipelineData();
          },
        },
      );

      await refreshPipelineData();
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

                <PipelineConfigurationPanel
                  schema={pipelineConfigurationSchema}
                  configuration={pipelineConfiguration}
                  validation={pipelineConfigurationValidation}
                  loading={pipelineConfigurationLoading}
                  validating={pipelineConfigurationValidating}
                  error={pipelineConfigurationError}
                  onParameterChange={
                    setPipelineConfigurationParameter
                  }
                  onResetParameter={
                    resetPipelineConfigurationParameter
                  }
                  onResetSection={
                    resetPipelineConfigurationSection
                  }
                  onResetAll={
                    resetPipelineConfiguration
                  }
                  onValidate={
                    validateCurrentPipelineConfiguration
                  }
                />

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
                        pipelineConfigurationLoading ||
                        pipelineConfigurationValidating ||
                        !pipelineConfigurationSchema ||
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

                      <div className="job-card-actions">
                        <StatusBadge status={job.status} />

                        <button
                          type="button"
                          className="view-results-button"
                          disabled={!engineStarted}
                          onClick={() =>
                            showJobResults(
                              job.source.jobId,
                            )
                          }
                        >
                          <Database size={14} />
                          Voir les fichiers
                        </button>

                        {(job.status === "error" ||
                          job.status === "interrupted") && (
                          <button
                            type="button"
                            className="restart-job-button"
                            disabled={
                              !engineStarted ||
                              restartingJobId !== null
                            }
                            onClick={() =>
                              void restartJob(
                                job.source.jobId,
                              )
                            }
                          >
                            <RefreshCw
                              size={14}
                              className={
                                restartingJobId ===
                                job.source.jobId
                                  ? "icon-spinning"
                                  : ""
                              }
                            />

                            {restartingJobId ===
                            job.source.jobId
                              ? "Relance…"
                              : "Relancer"}
                          </button>
                        )}
                      </div>
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
                      {selectedResultJob
                        ? `Fichiers du job ${selectedResultJob.name}`
                        : "Sélectionnez une analyse pour consulter ses fichiers."}
                    </p>
                  </div>

                  {selectedResultJobId && (
                    <button
                      className="button button-secondary"
                      disabled={resultFilesLoading}
                      onClick={() =>
                        void refreshResultFiles()
                      }
                    >
                      <RefreshCw
                        size={17}
                        className={
                          resultFilesLoading
                            ? "icon-spinning"
                            : ""
                        }
                      />
                      Actualiser
                    </button>
                  )}
                </div>

                {!selectedResultJobId && (
                  <article className="card empty-state">
                    Ouvrez « Analyses récentes », puis cliquez
                    sur « Voir les fichiers ».
                  </article>
                )}

                {resultFilesError && (
                  <div className="backend-error-panel">
                    <strong>
                      Impossible de charger les fichiers
                    </strong>
                    <span>{resultFilesError}</span>
                  </div>
                )}

                {resultActionError && (
                  <div className="backend-error-panel">
                    <strong>
                      Action impossible sur le fichier
                    </strong>
                    <span>{resultActionError}</span>
                  </div>
                )}

                {resultActionMessage && (
                  <div className="result-action-success">
                    {resultActionMessage}
                  </div>
                )}

                {selectedResultJobId &&
                  !resultFilesLoading &&
                  !resultFilesError &&
                  selectedJobFiles.length === 0 && (
                    <article className="card empty-state">
                      Ce job ne contient encore aucun fichier.
                    </article>
                  )}

                {selectedResultJobId &&
                  selectedJobFiles.length > 0 && (
                    <div className="result-groups">
                      {[
                        {
                          key: "output" as const,
                          title: "Fichiers de sortie",
                        },
                        {
                          key: "log" as const,
                          title: "Journaux",
                        },
                        {
                          key: "intermediate" as const,
                          title: "Résultats intermédiaires",
                        },
                        {
                          key: "input" as const,
                          title: "Fichiers d’entrée",
                        },
                      ].map((group) => {
                        const groupFiles =
                          filesByCategory[group.key];

                        if (groupFiles.length === 0) {
                          return null;
                        }

                        return (
                          <article
                            className="card result-group"
                            key={group.key}
                          >
                            <div className="card-title">
                              <h3>{group.title}</h3>
                              <span>
                                {groupFiles.length} fichier(s)
                              </span>
                            </div>

                            {groupFiles.map((file) => (
                              <div
                                className="result-file-row"
                                key={file.relativePath}
                              >
                                <Database size={18} />

                                <div>
                                  <strong>
                                    {getPipelineFileName(
                                      file.relativePath,
                                    )}
                                  </strong>
                                  <span>
                                    {file.relativePath}
                                  </span>
                                </div>

                                <small>
                                  {formatFileSize(
                                    file.sizeBytes,
                                  )}
                                </small>

                                <div className="result-file-actions">
                                  <button
                                    type="button"
                                    disabled={
                                      resultActionPending !== null
                                    }
                                    onClick={() =>
                                      void handleOpenResultFile(
                                        file.relativePath,
                                      )
                                    }
                                  >
                                    {resultActionPending ===
                                    `open:${file.relativePath}`
                                      ? "Ouverture…"
                                      : "Ouvrir"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      resultActionPending !== null
                                    }
                                    onClick={() =>
                                      void handleExportResultFile(
                                        file.relativePath,
                                      )
                                    }
                                  >
                                    {resultActionPending ===
                                    `export:${file.relativePath}`
                                      ? "Export…"
                                      : "Exporter sous…"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </article>
                        );
                      })}
                    </div>
                  )}
              </>
            )}

          </motion.div>
        </section>
      </div>
    </main>
  );
}

export default App;
