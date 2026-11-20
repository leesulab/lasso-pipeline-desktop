import { useMemo, useState } from "react";
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
import "./App.css";

type JobStatus = "success" | "running" | "error";
type View = "overview" | "new" | "jobs" | "results";

type Job = {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  step: string;
  updated: string;
};

type PipelineStep = {
  id: string;
  label: string;
};

const initialJobs: Job[] = [
  {
    id: "b8d2…91ec",
    name: "Observatoire HRMS · Bougival",
    status: "success",
    progress: 100,
    step: "Terminé",
    updated: "Aujourd’hui, 17:42",
  },
  {
    id: "2a41…d067",
    name: "Campagne Seine · Lot 04",
    status: "running",
    progress: 42,
    step: "Traitement des échantillons",
    updated: "Aujourd’hui, 18:31",
  },
  {
    id: "fa09…38bd",
    name: "Essai calibration",
    status: "error",
    progress: 5,
    step: "Calibration absente",
    updated: "Hier, 16:08",
  },
];

const pipelineSteps: PipelineStep[] = [
  { id: "calibration", label: "Calibration CCS" },
  { id: "identification", label: "Base d’identification" },
  { id: "file_discovery", label: "Détection des fichiers" },
  { id: "blanks", label: "Traitement des blanks" },
  { id: "samples", label: "Traitement des échantillons" },
  {
    id: "feature_alignment",
    label: "Alignement et identification",
  },
  { id: "visualizations", label: "Visualisations" },
  { id: "similarities", label: "Similarités" },
  { id: "categories", label: "Catégories" },
];

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
  const [engineStarted, setEngineStarted] = useState(true);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [selectedSteps, setSelectedSteps] = useState<string[]>(
    pipelineSteps.map((step) => step.id),
  );
  const [view, setView] = useState<View>("overview");

  const runningJobs = useMemo(
    () => jobs.filter((job) => job.status === "running").length,
    [jobs],
  );

  function toggleStep(stepId: string) {
    setSelectedSteps((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId],
    );
  }

  function createDemoJob() {
    const firstStep =
      pipelineSteps.find((step) =>
        selectedSteps.includes(step.id),
      )?.label ?? "En attente";

    const newJob: Job = {
      id: "new…local",
      name: "Nouvelle analyse locale",
      status: "running",
      progress: 0,
      step: firstStep,
      updated: "À l’instant",
    };

    setJobs((current) => [newJob, ...current]);
    setView("jobs");
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
              {engineStarted
                ? "Moteur local actif"
                : "Moteur arrêté"}
            </div>

            <button
              className="button button-secondary"
              onClick={() =>
                setEngineStarted((value) => !value)
              }
            >
              <Server size={17} />
              {engineStarted ? "Arrêter" : "Démarrer"}
            </button>
          </div>
        </div>
      </header>

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
                      disabled={
                        !engineStarted ||
                        selectedSteps.length === 0
                      }
                      onClick={createDemoJob}
                    >
                      <Play size={17} />
                      Créer et lancer
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
