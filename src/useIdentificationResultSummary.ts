import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  fetchIdentificationResultSummary,
  type IdentificationResultSummary,
} from "./api";
import type { BackendStatus } from "./backend";

function isMissingSummaryError(
  error: unknown,
): boolean {
  const message = String(error);

  return (
    message.includes("features complètes introuvable") ||
    message.includes("Erreur HTTP 404")
  );
}

export function useIdentificationResultSummary(
  backendStatus: BackendStatus,
  jobId: string | null,
) {
  const [summary, setSummary] =
    useState<IdentificationResultSummary | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [unavailable, setUnavailable] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendStatus.running || !jobId) {
      setSummary(null);
      setLoading(false);
      setUnavailable(false);
      setError(null);
      return;
    }

    setLoading(true);
    setUnavailable(false);
    setError(null);

    try {
      const loadedSummary =
        await fetchIdentificationResultSummary(
          backendStatus,
          jobId,
        );

      setSummary(loadedSummary);
    } catch (requestError) {
      setSummary(null);

      if (isMissingSummaryError(requestError)) {
        setUnavailable(true);
      } else {
        setError(String(requestError));
      }
    } finally {
      setLoading(false);
    }
  }, [backendStatus, jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    summary,
    loading,
    unavailable,
    error,
    refresh,
  };
}
