import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  fetchPipelineFiles,
  type PipelineFile,
} from "./api";
import type { BackendStatus } from "./backend";

export type PipelineFilesByCategory = {
  output: PipelineFile[];
  log: PipelineFile[];
  intermediate: PipelineFile[];
  input: PipelineFile[];
  state: PipelineFile[];
  metadata: PipelineFile[];
};

const emptyFilesByCategory: PipelineFilesByCategory = {
  output: [],
  log: [],
  intermediate: [],
  input: [],
  state: [],
  metadata: [],
};

function groupFiles(
  files: PipelineFile[],
): PipelineFilesByCategory {
  const grouped: PipelineFilesByCategory = {
    output: [],
    log: [],
    intermediate: [],
    input: [],
    state: [],
    metadata: [],
  };

  for (const file of files) {
    grouped[file.category].push(file);
  }

  return grouped;
}

export function formatFileSize(
  sizeBytes: number,
): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} octets`;
  }

  const sizeKilobytes = sizeBytes / 1024;

  if (sizeKilobytes < 1024) {
    return `${sizeKilobytes.toFixed(1)} Ko`;
  }

  const sizeMegabytes = sizeKilobytes / 1024;

  if (sizeMegabytes < 1024) {
    return `${sizeMegabytes.toFixed(1)} Mo`;
  }

  const sizeGigabytes = sizeMegabytes / 1024;

  return `${sizeGigabytes.toFixed(2)} Go`;
}

export function getPipelineFileName(
  relativePath: string,
): string {
  const pathParts = relativePath.split("/");
  return pathParts[pathParts.length - 1] || relativePath;
}

export function usePipelineFiles(
  backendStatus: BackendStatus,
  jobId: string | null,
) {
  const [files, setFiles] = useState<PipelineFile[]>([]);
  const [filesByCategory, setFilesByCategory] =
    useState<PipelineFilesByCategory>(
      emptyFilesByCategory,
    );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendStatus.running || !jobId) {
      setFiles([]);
      setFilesByCategory(emptyFilesByCategory);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedFiles = await fetchPipelineFiles(
        backendStatus,
        jobId,
      );

      setFiles(loadedFiles);
      setFilesByCategory(
        groupFiles(loadedFiles),
      );
    } catch (requestError) {
      setFiles([]);
      setFilesByCategory(emptyFilesByCategory);
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  }, [backendStatus, jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    files,
    filesByCategory,
    loading,
    error,
    refresh,
  };
}
