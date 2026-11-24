import { useMemo, useState } from "react";
import {
  BarChart3,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  Image,
  Table2,
} from "lucide-react";
import type { PipelineResultEntry } from "./api";
import type { BackendStatus } from "./backend";
import {
  ScientificImagePreview,
} from "./ScientificImagePreview";
import {
  ScientificTextPreview,
} from "./ScientificTextPreview";
import { formatFileSize } from "./usePipelineFiles";
import "./ScientificResultsPanel.css";

type ResultTab =
  | "summary"
  | "visualizations"
  | "tables"
  | "reports";

type ScientificResultsPanelProps = {
  backendStatus: BackendStatus;
  jobId: string;
  results: PipelineResultEntry[];
  visualizations: PipelineResultEntry[];
  tables: PipelineResultEntry[];
  reports: PipelineResultEntry[];
  pendingAction: string | null;
  onOpen: (relativePath: string) => Promise<void>;
  onExport: (relativePath: string) => Promise<void>;
};

const groupLabels: Record<string, string> = {
  visualizations: "Visualisations générales",
  similarities: "Similarités",
  categories: "Catégories",
  tables: "Tables scientifiques",
  other: "Autres résultats",
};

function ResultIcon({ result }: { result: PipelineResultEntry }) {
  if (result.kind === "image") return <Image size={19} />;
  if (result.kind === "table") return <Table2 size={19} />;
  if (result.kind === "text") return <FileText size={19} />;
  if (result.kind === "html") return <BarChart3 size={19} />;
  return <FolderOpen size={19} />;
}

function ResultCards({
  backendStatus,
  jobId,
  results,
  pendingAction,
  onOpen,
  onExport,
}: {
  backendStatus: BackendStatus;
  jobId: string;
  results: PipelineResultEntry[];
  pendingAction: string | null;
  onOpen: (relativePath: string) => Promise<void>;
  onExport: (relativePath: string) => Promise<void>;
}) {
  if (results.length === 0) {
    return (
      <div className="scientific-results-empty">
        Aucun résultat disponible dans cette catégorie.
      </div>
    );
  }

  return (
    <div className="scientific-result-grid">
      {results.map((result) => (
        <article className="scientific-result-card" key={result.id}>
          <div className="scientific-result-icon">
            <ResultIcon result={result} />
          </div>

          <div className="scientific-result-description">
            <strong>{result.title}</strong>
            <span>{groupLabels[result.group] ?? result.group}</span>
            <small>
              {result.format.toUpperCase()} · {formatFileSize(result.sizeBytes)}
            </small>
            <code>{result.relativePath}</code>
          </div>

          {result.kind === "image" && (
            <ScientificImagePreview
              backendStatus={backendStatus}
              jobId={jobId}
              result={result}
            />
          )}

          {result.kind === "text" && (
            <ScientificTextPreview
              backendStatus={backendStatus}
              jobId={jobId}
              result={result}
            />
          )}

          <div className="scientific-result-actions">
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => void onOpen(result.relativePath)}
            >
              <ExternalLink size={14} />
              {pendingAction === `open:${result.relativePath}`
                ? "Ouverture…"
                : "Ouvrir"}
            </button>

            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => void onExport(result.relativePath)}
            >
              {pendingAction === `export:${result.relativePath}`
                ? "Export…"
                : "Exporter"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ScientificResultsPanel({
  backendStatus,
  jobId,
  results,
  visualizations,
  tables,
  reports,
  pendingAction,
  onOpen,
  onExport,
}: ScientificResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");

  const groups = useMemo(() => {
    const grouped = new Map<string, PipelineResultEntry[]>();

    for (const result of results) {
      grouped.set(result.group, [
        ...(grouped.get(result.group) ?? []),
        result,
      ]);
    }

    return [...grouped.entries()];
  }, [results]);

  const tabs: Array<{ id: ResultTab; label: string; count: number }> = [
    { id: "summary", label: "Synthèse", count: results.length },
    {
      id: "visualizations",
      label: "Visualisations",
      count: visualizations.length,
    },
    { id: "tables", label: "Tables", count: tables.length },
    { id: "reports", label: "Rapports", count: reports.length },
  ];

  return (
    <section className="card scientific-results-panel">
      <nav className="scientific-results-tabs" aria-label="Résultats scientifiques">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
      </nav>

      <div className="scientific-results-content">
        {activeTab === "summary" && (
          <div className="scientific-results-summary">
            {groups.length === 0 ? (
              <div className="scientific-results-empty">
                Aucun résultat scientifique n’a encore été produit.
              </div>
            ) : (
              groups.map(([group, groupResults]) => (
                <div className="scientific-summary-group" key={group}>
                  <div>
                    <Database size={18} />
                    <strong>{groupLabels[group] ?? group}</strong>
                  </div>
                  <span>{groupResults.length} résultat(s)</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "visualizations" && (
          <ResultCards
            backendStatus={backendStatus}
            jobId={jobId}
            results={visualizations}
            pendingAction={pendingAction}
            onOpen={onOpen}
            onExport={onExport}
          />
        )}

        {activeTab === "tables" && (
          <ResultCards
            backendStatus={backendStatus}
            jobId={jobId}
            results={tables}
            pendingAction={pendingAction}
            onOpen={onOpen}
            onExport={onExport}
          />
        )}

        {activeTab === "reports" && (
          <ResultCards
            backendStatus={backendStatus}
            jobId={jobId}
            results={reports}
            pendingAction={pendingAction}
            onOpen={onOpen}
            onExport={onExport}
          />
        )}
      </div>
    </section>
  );
}
