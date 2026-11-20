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
import { usePipelineData } from "./usePipelineData";
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

                  <div className="pipeline-actions">
                    <button className="button button-secondary">
                      <FolderOpen size={17} />
                      Sélectionner les fichiers
                    </button>

                    <button
                      className="button button-primary"
                      disabled
                      title={
                        "La création de jobs sera raccordée " +
                        "à l'API à l'étape suivante."
                      }
                    >
                      <Play size={17} />
                      Création API à connecter
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
