import type { BackendStatus } from "./backend";

export type PipelineJobStatus =
  | "created"
  | "running"
  | "success"
  | "error";

export type PipelineJob = {
  jobId: string;
  status: PipelineJobStatus;
  steps: string[];
  parameters: Record<string, unknown>;
  progress: number;
  currentStep: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: {
    type: string;
    message: string;
  } | null;
  result: Record<string, unknown> | null;
  workingDir: string;
};

type ApiJobResponse = {
  job_id: string;
  status: PipelineJobStatus;
  steps: string[];
  parameters: Record<string, unknown>;
  progress: number;
  current_step: string | null;
  message: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: {
    type: string;
    message: string;
  } | null;
  result: Record<string, unknown> | null;
  working_dir: string;
};

function requireConnection(
  backend: BackendStatus,
): {
  baseUrl: string;
  token: string;
} {
  if (
    !backend.running ||
    !backend.baseUrl ||
    !backend.token
  ) {
    throw new Error(
      "Le moteur local n'est pas disponible.",
    );
  }

  return {
    baseUrl: backend.baseUrl,
    token: backend.token,
  };
}

async function apiRequest<T>(
  backend: BackendStatus,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { baseUrl, token } = requireConnection(backend);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let detail = `Erreur HTTP ${response.status}`;

    try {
      const payload = (await response.json()) as {
        detail?: string;
      };

      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // La réponse n'était pas au format JSON.
    }

    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

function mapJob(job: ApiJobResponse): PipelineJob {
  return {
    jobId: job.job_id,
    status: job.status,
    steps: job.steps,
    parameters: job.parameters,
    progress: job.progress,
    currentStep: job.current_step,
    message: job.message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    error: job.error,
    result: job.result,
    workingDir: job.working_dir,
  };
}

export async function fetchPipelineSteps(
  backend: BackendStatus,
): Promise<string[]> {
  return apiRequest<string[]>(
    backend,
    "/api/v1/steps",
  );
}

export async function fetchPipelineJobs(
  backend: BackendStatus,
): Promise<PipelineJob[]> {
  const jobs = await apiRequest<ApiJobResponse[]>(
    backend,
    "/api/v1/jobs",
  );

  return jobs.map(mapJob);
}
