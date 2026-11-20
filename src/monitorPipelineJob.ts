import {
  fetchPipelineJob,
  type PipelineJob,
} from "./api";
import type { BackendStatus } from "./backend";

export type JobMonitorOptions = {
  pollingIntervalMs?: number;
  onUpdate?: (job: PipelineJob) => void | Promise<void>;
};

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export async function monitorPipelineJob(
  backend: BackendStatus,
  jobId: string,
  options: JobMonitorOptions = {},
): Promise<PipelineJob> {
  const {
    pollingIntervalMs = 1_000,
    onUpdate,
  } = options;

  if (pollingIntervalMs < 250) {
    throw new Error(
      "L’intervalle de suivi doit être supérieur ou égal à 250 ms.",
    );
  }

  while (true) {
    const job = await fetchPipelineJob(
      backend,
      jobId,
    );

    await onUpdate?.(job);

    if (job.status === "success") {
      return job;
    }

    if (job.status === "error") {
      throw new Error(
        job.error?.message ||
          job.message ||
          "La pipeline s’est terminée en erreur.",
      );
    }

    await wait(pollingIntervalMs);
  }
}
