import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  fetchPipelineJobs,
  fetchPipelineSteps,
  type PipelineJob,
} from "./api";
import type { BackendStatus } from "./backend";

const stepLabels: Record<string, string> = {
  calibration: "Calibration CCS",
  identification: "Base d’identification",
  file_discovery: "Détection des fichiers",
  blanks: "Traitement des blanks",
  samples: "Traitement des échantillons",
  feature_alignment: "Alignement et identification",
  visualizations: "Visualisations",
  similarities: "Similarités",
  categories: "Catégories",
};

export type PipelineStep = {
  id: string;
  label: string;
};

export type DisplayJob = {
  id: string;
  name: string;
  status:
    | "success"
    | "running"
    | "error"
    | "created"
    | "interrupted";
  progress: number;
  step: string;
  updated: string;
  source: PipelineJob;
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function mapJob(job: PipelineJob): DisplayJob {
  const projectName = job.parameters.project;

  const name =
    typeof projectName === "string" && projectName.trim()
      ? projectName
      : `Analyse ${job.jobId.slice(0, 8)}`;

  const currentStep = job.currentStep
    ? stepLabels[job.currentStep] ?? job.currentStep
    : null;

  const step =
    currentStep ??
    (job.status === "success"
      ? "Terminé"
      : job.status === "error" ||
          job.status === "interrupted"
        ? job.error?.message ?? job.message
        : job.message);

  return {
    id: job.jobId,
    name,
    status: job.status,
    progress: Math.round(job.progress * 100),
    step,
    updated: formatDate(job.updatedAt),
    source: job,
  };
}

export function usePipelineData(
  backendStatus: BackendStatus,
) {
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [jobs, setJobs] = useState<DisplayJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendStatus.running) {
      setSteps([]);
      setJobs([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [stepIds, pipelineJobs] = await Promise.all([
        fetchPipelineSteps(backendStatus),
        fetchPipelineJobs(backendStatus),
      ]);

      setSteps(
        stepIds.map((id) => ({
          id,
          label: stepLabels[id] ?? id,
        })),
      );

      setJobs(pipelineJobs.map(mapJob));
    } catch (requestError) {
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  }, [backendStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    steps,
    jobs,
    loading,
    error,
    refresh,
  };
}
