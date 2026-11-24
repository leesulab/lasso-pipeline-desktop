import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchPipelineResultManifest,
  type PipelineResultEntry,
  type PipelineResultManifest,
} from "./api";
import type { BackendStatus } from "./backend";

export type PipelineResultsByGroup = Record<
  string,
  PipelineResultEntry[]
>;

export function usePipelineResults(
  backendStatus: BackendStatus,
  jobId: string | null,
) {
  const [manifest, setManifest] =
    useState<PipelineResultManifest | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendStatus.running || !jobId) {
      setManifest(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedManifest =
        await fetchPipelineResultManifest(
          backendStatus,
          jobId,
        );

      setManifest(loadedManifest);
    } catch (requestError) {
      setManifest(null);
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  }, [backendStatus, jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resultsByGroup = useMemo(() => {
    const groups: PipelineResultsByGroup = {};

    for (const result of manifest?.results ?? []) {
      groups[result.group] = [
        ...(groups[result.group] ?? []),
        result,
      ];
    }

    return groups;
  }, [manifest]);

  const visualizations = useMemo(
    () =>
      (manifest?.results ?? []).filter(
        (result) =>
          result.kind === "image" ||
          result.kind === "html",
      ),
    [manifest],
  );

  const tables = useMemo(
    () =>
      (manifest?.results ?? []).filter(
        (result) => result.kind === "table",
      ),
    [manifest],
  );

  const reports = useMemo(
    () =>
      (manifest?.results ?? []).filter(
        (result) => result.kind === "text",
      ),
    [manifest],
  );

  return {
    manifest,
    results: manifest?.results ?? [],
    resultsByGroup,
    visualizations,
    tables,
    reports,
    loading,
    error,
    refresh,
  };
}
