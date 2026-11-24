import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  fetchPipelineResultBlob,
  type PipelineResultEntry,
} from "./api";
import type { BackendStatus } from "./backend";

const MAX_PREVIEW_CHARACTERS = 100_000;

type ScientificTextPreviewProps = {
  backendStatus: BackendStatus;
  jobId: string;
  result: PipelineResultEntry;
};

export function ScientificTextPreview({
  backendStatus,
  jobId,
  result,
}: ScientificTextPreviewProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [content, setContent] =
    useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting,
          )
        ) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "150px",
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !visible ||
      !backendStatus.running ||
      result.kind !== "text"
    ) {
      return;
    }

    let cancelled = false;

    async function loadText() {
      setLoading(true);
      setError(null);

      try {
        const blob = await fetchPipelineResultBlob(
          backendStatus,
          jobId,
          result.relativePath,
        );

        const text = await blob.text();

        if (cancelled) {
          return;
        }

        const isTruncated =
          text.length > MAX_PREVIEW_CHARACTERS;

        setContent(
          isTruncated
            ? text.slice(
                0,
                MAX_PREVIEW_CHARACTERS,
              )
            : text,
        );

        setTruncated(isTruncated);
      } catch (loadError) {
        if (!cancelled) {
          setError(String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadText();

    return () => {
      cancelled = true;
    };
  }, [
    backendStatus,
    jobId,
    result.kind,
    result.relativePath,
    visible,
  ]);

  return (
    <div
      ref={containerRef}
      className="scientific-text-preview"
    >
      {!visible && (
        <span>Prévisualisation en attente…</span>
      )}

      {visible && loading && (
        <span>Chargement du rapport…</span>
      )}

      {error && (
        <span className="scientific-text-error">
          Prévisualisation impossible : {error}
        </span>
      )}

      {content !== null && (
        <>
          <pre>{content}</pre>

          {truncated && (
            <small>
              Aperçu limité aux premiers{" "}
              {MAX_PREVIEW_CHARACTERS.toLocaleString(
                "fr-FR",
              )}{" "}
              caractères. Utilisez « Ouvrir » pour
              consulter le rapport complet.
            </small>
          )}
        </>
      )}
    </div>
  );
}
