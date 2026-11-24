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

type ScientificImagePreviewProps = {
  backendStatus: BackendStatus;
  jobId: string;
  result: PipelineResultEntry;
};

export function ScientificImagePreview({
  backendStatus,
  jobId,
  result,
}: ScientificImagePreviewProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [imageUrl, setImageUrl] =
    useState<string | null>(null);
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
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "150px",
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      !visible ||
      !backendStatus.running ||
      result.kind !== "image"
    ) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadImage() {
      setLoading(true);
      setError(null);

      try {
        const blob = await fetchPipelineResultBlob(
          backendStatus,
          jobId,
          result.relativePath,
        );

        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
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

    void loadImage();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
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
      className="scientific-image-preview"
    >
      {!visible && (
        <span>Prévisualisation en attente…</span>
      )}

      {visible && loading && (
        <span>Chargement de l’image…</span>
      )}

      {error && (
        <span className="scientific-image-error">
          Prévisualisation impossible : {error}
        </span>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt={result.title}
          loading="lazy"
        />
      )}
    </div>
  );
}
