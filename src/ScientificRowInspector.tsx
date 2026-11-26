import {
  Check,
  Clipboard,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  PipelineTableCell,
  PipelineTableColumn,
} from "./api";

type ScientificRowInspectorProps = {
  columns: PipelineTableColumn[];
  row: Record<string, PipelineTableCell>;
  rowNumber: number;
  onClose: () => void;
};

function formatValue(
  value: PipelineTableCell,
): string {
  if (value === null) {
    return "NULL";
  }

  return String(value);
}

function rowAsJson(
  columns: PipelineTableColumn[],
  row: Record<string, PipelineTableCell>,
): string {
  const orderedRow = Object.fromEntries(
    columns.map((column) => [
      column.name,
      row[column.name] ?? null,
    ]),
  );

  return JSON.stringify(
    orderedRow,
    null,
    2,
  );
}

export function ScientificRowInspector({
  columns,
  row,
  rowNumber,
  onClose,
}: ScientificRowInspectorProps) {
  const [copied, setCopied] =
    useState(false);

  const json = useMemo(
    () => rowAsJson(columns, row),
    [columns, row],
  );

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

  async function copyRow() {
    try {
      await navigator.clipboard.writeText(
        json,
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
      className="scientific-row-inspector-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="scientific-row-inspector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scientific-row-title"
      >
        <header>
          <div>
            <strong id="scientific-row-title">
              Ligne {rowNumber.toLocaleString("fr-FR")}
            </strong>

            <span>
              {columns.length} colonne(s) affichée(s)
            </span>
          </div>

          <button
            type="button"
            title="Fermer"
            aria-label="Fermer l’inspecteur de ligne"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>

        <div className="scientific-row-fields">
          {columns.map((column) => {
            const value =
              row[column.name] ?? null;

            return (
              <article key={column.name}>
                <header>
                  <strong>{column.name}</strong>
                  <span>{column.type}</span>
                </header>

                <pre
                  className={
                    value === null
                      ? "is-null"
                      : ""
                  }
                >
                  {formatValue(value)}
                </pre>
              </article>
            );
          })}
        </div>

        <footer>
          <button
            type="button"
            onClick={() => void copyRow()}
          >
            {copied ? (
              <Check size={14} />
            ) : (
              <Clipboard size={14} />
            )}

            {copied
              ? "Ligne copiée"
              : "Copier en JSON"}
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
