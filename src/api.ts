import type { BackendStatus } from "./backend";

export type PipelineJobStatus =
  | "created"
  | "running"
  | "success"
  | "error"
  | "interrupted";

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

export async function createPipelineJob(
  backend: BackendStatus,
  steps: string[],
  projectName: string,
  pipelineConfiguration:
    NormalizedPipelineConfiguration,
): Promise<PipelineJob> {
  const job = await apiRequest<ApiJobResponse>(
    backend,
    "/api/v1/jobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        steps,
        parameters: {
          project: projectName,
          pipeline_configuration:
            pipelineConfiguration,
        },
      }),
    },
  );

  return mapJob(job);
}

export async function runPipelineJob(
  backend: BackendStatus,
  jobId: string,
): Promise<PipelineJob> {
  const job = await apiRequest<ApiJobResponse>(
    backend,
    `/api/v1/jobs/${encodeURIComponent(jobId)}/run`,
    {
      method: "POST",
    },
  );

  return mapJob(job);
}

export async function fetchPipelineJob(
  backend: BackendStatus,
  jobId: string,
): Promise<PipelineJob> {
  const job = await apiRequest<ApiJobResponse>(
    backend,
    `/api/v1/jobs/${encodeURIComponent(jobId)}`,
  );

  return mapJob(job);
}

export type PipelineFileCategory =
  | "input"
  | "intermediate"
  | "output"
  | "log"
  | "state"
  | "metadata";

export type PipelineFile = {
  relativePath: string;
  sizeBytes: number;
  category: PipelineFileCategory;
};

type ApiFileResponse = {
  relative_path: string;
  size_bytes: number;
  category: PipelineFileCategory;
};

export async function fetchPipelineFiles(
  backend: BackendStatus,
  jobId: string,
): Promise<PipelineFile[]> {
  const files = await apiRequest<ApiFileResponse[]>(
    backend,
    `/api/v1/jobs/${encodeURIComponent(jobId)}/files`,
  );

  return files.map((file) => ({
    relativePath: file.relative_path,
    sizeBytes: file.size_bytes,
    category: file.category,
  }));
}

export type PipelineParameterType =
  | "boolean"
  | "integer"
  | "number"
  | "string";

export type PipelineParameterSchema = {
  path: string;
  label: string;
  type: PipelineParameterType;
  default: boolean | number | string;
  required: boolean;
  description: string | null;
  unit: string | null;
  minimum: number | null;
  maximum: number | null;
  step: number | null;
  choices: string[] | null;
  group: string | null;
};

export type PipelineSectionSchema = {
  id: string;
  label: string;
  className: string;
  parameters: PipelineParameterSchema[];
};

export type PipelineSchema = {
  version: number;
  sections: PipelineSectionSchema[];
};

/**
 * Configuration éditable envoyée par l'interface.
 *
 * Les paramètres imbriqués utilisent des chemins pointés :
 * "weights.mz", "tolerances.ccs_percent", etc.
 */
export type PipelineConfiguration = Record<
  string,
  Record<string, unknown>
>;

/**
 * Configuration normalisée renvoyée par l'API.
 *
 * Les chemins pointés y sont reconstruits en objets imbriqués.
 */
export type NormalizedPipelineConfiguration = Record<
  string,
  Record<string, unknown>
>;

export type ConfigurationValidationResult = {
  valid: boolean;
  configuration: NormalizedPipelineConfiguration;
  errors: string[];
};

type ApiPipelineSectionSchema = {
  id: string;
  label: string;
  class_name: string;
  parameters: PipelineParameterSchema[];
};

type ApiPipelineSchema = {
  version: number;
  sections: ApiPipelineSectionSchema[];
};

type ApiConfigurationValidationResult = {
  valid: boolean;
  configuration: NormalizedPipelineConfiguration;
  errors: string[];
};

function mapPipelineSchema(
  schema: ApiPipelineSchema,
): PipelineSchema {
  return {
    version: schema.version,
    sections: schema.sections.map((section) => ({
      id: section.id,
      label: section.label,
      className: section.class_name,
      parameters: section.parameters,
    })),
  };
}

export async function fetchPipelineSchema(
  backend: BackendStatus,
): Promise<PipelineSchema> {
  const schema = await apiRequest<ApiPipelineSchema>(
    backend,
    "/api/v1/pipeline/schema",
  );

  return mapPipelineSchema(schema);
}

export async function validatePipelineConfiguration(
  backend: BackendStatus,
  configuration: PipelineConfiguration,
): Promise<ConfigurationValidationResult> {
  return apiRequest<ApiConfigurationValidationResult>(
    backend,
    "/api/v1/pipeline/configuration/validate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        configuration,
      }),
    },
  );
}

export type PipelinePreset = {
  formatVersion: number;
  schemaVersion: number;
  id: string | null;
  name: string;
  description: string;
  builtIn: boolean;
  createdAt: string | null;
  configuration: NormalizedPipelineConfiguration;
};

export type PipelinePresetValidationResult = {
  valid: boolean;
  preset: PipelinePreset | null;
  errors: string[];
};

type ApiPipelinePreset = {
  format_version: number;
  schema_version: number;
  id: string | null;
  name: string;
  description: string;
  built_in: boolean;
  created_at: string | null;
  configuration: NormalizedPipelineConfiguration;
};

type ApiPipelinePresetValidationResult = {
  valid: boolean;
  preset: ApiPipelinePreset | null;
  errors: string[];
};

function mapPipelinePreset(
  preset: ApiPipelinePreset,
): PipelinePreset {
  return {
    formatVersion: preset.format_version,
    schemaVersion: preset.schema_version,
    id: preset.id,
    name: preset.name,
    description: preset.description,
    builtIn: preset.built_in,
    createdAt: preset.created_at,
    configuration: preset.configuration,
  };
}

export async function fetchPipelinePresets(
  backend: BackendStatus,
): Promise<PipelinePreset[]> {
  const presets = await apiRequest<ApiPipelinePreset[]>(
    backend,
    "/api/v1/pipeline/presets",
  );

  return presets.map(mapPipelinePreset);
}

export async function validatePipelinePreset(
  backend: BackendStatus,
  preset: Record<string, unknown>,
): Promise<PipelinePresetValidationResult> {
  const result =
    await apiRequest<ApiPipelinePresetValidationResult>(
      backend,
      "/api/v1/pipeline/presets/validate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preset,
        }),
      },
    );

  return {
    valid: result.valid,
    preset: result.preset
      ? mapPipelinePreset(result.preset)
      : null,
    errors: result.errors,
  };
}

export type PipelineResultKind =
  | "image"
  | "html"
  | "table"
  | "text"
  | "file";

export type PipelineResultEntry = {
  id: string;
  title: string;
  group: string;
  kind: PipelineResultKind;
  format: string;
  relativePath: string;
  sizeBytes: number;
  order: number;
};

export type PipelineResultManifest = {
  version: number;
  jobId: string;
  results: PipelineResultEntry[];
};

type ApiPipelineResultEntry = {
  id: string;
  title: string;
  group: string;
  kind: PipelineResultKind;
  format: string;
  relative_path: string;
  size_bytes: number;
  order: number;
};

type ApiPipelineResultManifest = {
  version: number;
  job_id: string;
  results: ApiPipelineResultEntry[];
};

export async function fetchPipelineResultManifest(
  backend: BackendStatus,
  jobId: string,
): Promise<PipelineResultManifest> {
  const manifest =
    await apiRequest<ApiPipelineResultManifest>(
      backend,
      `/api/v1/jobs/${encodeURIComponent(jobId)}/results`,
    );

  return {
    version: manifest.version,
    jobId: manifest.job_id,
    results: manifest.results.map((result) => ({
      id: result.id,
      title: result.title,
      group: result.group,
      kind: result.kind,
      format: result.format,
      relativePath: result.relative_path,
      sizeBytes: result.size_bytes,
      order: result.order,
    })),
  };
}

function encodeRelativePath(
  relativePath: string,
): string {
  return relativePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function fetchPipelineResultBlob(
  backend: BackendStatus,
  jobId: string,
  relativePath: string,
): Promise<Blob> {
  const { baseUrl, token } = requireConnection(backend);

  const encodedJobId = encodeURIComponent(jobId);
  const encodedPath = encodeRelativePath(relativePath);

  const response = await fetch(
    `${baseUrl}/api/v1/jobs/${encodedJobId}/files/${encodedPath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "image/png,image/jpeg,image/svg+xml,text/plain,text/html",
      },
    },
  );

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
      // La réponse d'erreur n'était pas au format JSON.
    }

    throw new Error(detail);
  }

  return response.blob();
}

export type PipelineTableColumn = {
  name: string;
  type: string;
};

export type PipelineTableCell =
  | boolean
  | number
  | string
  | null;

export type PipelineTablePreview = {
  resultId: string;
  format: string;
  columns: PipelineTableColumn[];
  rows: Array<Record<string, PipelineTableCell>>;
  offset: number;
  limit: number;
  returned: number;
  total: number;
  hasMore: boolean;
  sortBy: string | null;
  sortDirection: "asc" | "desc" | null;
};

type ApiPipelineTablePreview = {
  result_id: string;
  format: string;
  columns: PipelineTableColumn[];
  rows: Array<Record<string, PipelineTableCell>>;
  offset: number;
  limit: number;
  returned: number;
  total: number;
  has_more: boolean;
  sort_by: string | null;
  sort_direction: "asc" | "desc" | null;
};

export type PipelineTablePreviewOptions = {
  offset?: number;
  limit?: number;
  columns?: string[];
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

export async function fetchPipelineTablePreview(
  backend: BackendStatus,
  jobId: string,
  resultId: string,
  options: PipelineTablePreviewOptions = {},
): Promise<PipelineTablePreview> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;

  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  if (options.columns?.length) {
    query.set(
      "columns",
      options.columns.join(","),
    );
  }

  if (options.sortBy) {
    query.set("sort_by", options.sortBy);
    query.set(
      "sort_direction",
      options.sortDirection ?? "asc",
    );
  }

  const preview =
    await apiRequest<ApiPipelineTablePreview>(
      backend,
      `/api/v1/jobs/${encodeURIComponent(
        jobId,
      )}/tables/${encodeURIComponent(
        resultId,
      )}/preview?${query.toString()}`,
    );

  return {
    resultId: preview.result_id,
    format: preview.format,
    columns: preview.columns,
    rows: preview.rows,
    offset: preview.offset,
    limit: preview.limit,
    returned: preview.returned,
    total: preview.total,
    hasMore: preview.has_more,
    sortBy: preview.sort_by,
    sortDirection: preview.sort_direction,
  };
}
