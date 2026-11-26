import {
  Check,
  Clipboard,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import type {
  PipelineTableCell,
} from "./api";

type ScientificCellInspectorProps = {
  columnName: string;
  columnType: string;
  value: PipelineTableCell;
  onClose: () => void;
};

function rawCellValue(
  value: PipelineTableCell,
): string {
  if (value === null) {
    return "";
  }

  return String(value);
}

function displayCellValue(
  value: PipelineTableCell,
): string {
  if (value === null) {
    return "Valeur nulle";
  }

  if (typeof value !== "string") {
    return String(value);
  }

  try {
    return JSON.stringify(
      JSON.parse(value),
      null,
      2,
    );
  } catch {
    return value;
  }
}

export function ScientificCellInspector({
  columnName,
  columnType,
  value,
  onClose,
}: ScientificCellInspectorProps) {
  const [copied, setCopied] = useState(false);

  const rawValue = rawCellValue(value);
  const displayedValue = displayCellValue(value);

  useEffect(() => {
    function closeOnEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [onClose]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(
        rawValue,
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1_500,
      );
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="scientific-cell-inspector-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="scientific-cell-inspector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scientific-cell-title"
      >
        <header>
          <div>
            <strong id="scientific-cell-title">
              {columnName}
            </strong>

            <span>{columnType}</span>
          </div>

          <button
            type="button"
            title="Fermer"
            aria-label="Fermer l’inspecteur"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>

        <div className="scientific-cell-inspector-metadata">
          <span>
            {rawValue.length.toLocaleString(
              "fr-FR",
            )}{" "}
            caractère(s)
          </span>

          {value === null && (
            <span>NULL</span>
          )}
        </div>

        <pre>{displayedValue}</pre>

        <footer>
          <button
            type="button"
            disabled={value === null}
            onClick={() => void copyValue()}
          >
            {copied ? (
              <Check size={14} />
            ) : (
              <Clipboard size={14} />
            )}

            {copied
              ? "Copié"
              : "Copier la valeur"}
          </button>

          <button
            type="button"
            onClick={onClose}
          >
            Fermer
          </button>
        </footer>
      </section>
    </div>
  );
}
