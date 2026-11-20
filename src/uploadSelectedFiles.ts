import { uploadPipelineFile } from "./backend";
import type { SelectedPipelineFiles } from "./fileSelection";

export type UploadProgress = {
  completed: number;
  total: number;
  currentFile: string | null;
};

type UploadItem = {
  destination:
    | "calibration"
    | "databases"
    | "blanks"
    | "samples";
  filePath: string;
};

function buildUploadQueue(
  files: SelectedPipelineFiles,
): UploadItem[] {
  const queue: UploadItem[] = [];

  if (files.calibration) {
    queue.push({
      destination: "calibration",
      filePath: files.calibration,
    });
  }

  if (files.database) {
    queue.push({
      destination: "databases",
      filePath: files.database,
    });
  }

  for (const filePath of files.blanks) {
    queue.push({
      destination: "blanks",
      filePath,
    });
  }

  for (const filePath of files.samples) {
    queue.push({
      destination: "samples",
      filePath,
    });
  }

  return queue;
}

export async function uploadSelectedPipelineFiles(
  jobId: string,
  files: SelectedPipelineFiles,
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> {
  const queue = buildUploadQueue(files);

  onProgress?.({
    completed: 0,
    total: queue.length,
    currentFile: null,
  });

  for (const [index, item] of queue.entries()) {
    onProgress?.({
      completed: index,
      total: queue.length,
      currentFile: item.filePath,
    });

    await uploadPipelineFile(
      jobId,
      item.destination,
      item.filePath,
    );

    onProgress?.({
      completed: index + 1,
      total: queue.length,
      currentFile: item.filePath,
    });
  }

  onProgress?.({
    completed: queue.length,
    total: queue.length,
    currentFile: null,
  });
}
