import { invoke } from "@tauri-apps/api/core";

export type BackendStatus = {
  running: boolean;
  pid: number | null;
  baseUrl: string | null;
  token: string | null;
  healthUrl: string | null;
  connectionFile: string | null;
  jobsDir: string | null;
  error: string | null;
};

export const stoppedBackendStatus: BackendStatus = {
  running: false,
  pid: null,
  baseUrl: null,
  token: null,
  healthUrl: null,
  connectionFile: null,
  jobsDir: null,
  error: null,
};

export async function getBackendStatus(): Promise<BackendStatus> {
  return invoke<BackendStatus>(
    "get_pipeline_backend_status",
  );
}

export async function startBackend(): Promise<BackendStatus> {
  return invoke<BackendStatus>(
    "start_pipeline_backend",
  );
}

export async function stopBackend(): Promise<BackendStatus> {
  return invoke<BackendStatus>(
    "stop_pipeline_backend",
  );
}
