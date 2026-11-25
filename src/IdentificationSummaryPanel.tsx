import {
  Database,
  FlaskConical,
  Gauge,
  Layers3,
  Microscope,
  Target,
} from "lucide-react";
import type {
  IdentificationResultSummary,
  PipelineTableFilter,
} from "./api";
import "./IdentificationSummaryPanel.css";

type IdentificationSummaryPanelProps = {
  summary: IdentificationResultSummary;
  onShowFilteredFeatures: (
    filters: PipelineTableFilter[],
  ) => void;
};

function formatInteger(
  value: number,
): string {
  return value.toLocaleString("fr-FR");
}

function formatPercent(
  value: number,
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatScore(
  value: number | null,
): string {
  if (value === null) {
    return "Non disponible";
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export function IdentificationSummaryPanel({
  summary,
  onShowFilteredFeatures,
}: IdentificationSummaryPanelProps) {
  const metrics: Array<{
    label: string;
    value: string;
    detail: string;
    icon: typeof Layers3;
    filters: PipelineTableFilter[];
  }> = [
    {
      label: "Features uniques",
      value: formatInteger(
        summary.uniqueFeatureCount,
      ),
      detail: (
        `${formatInteger(summary.rowCount)} ` +
        "lignes candidates"
      ),
      icon: Layers3,
      filters: [],
    },
    {
      label: "Features identifiées",
      value: formatInteger(
        summary.identifiedFeatureCount,
      ),
      detail: formatPercent(
        summary.featureIdentificationRate,
      ),
      icon: Target,
      filters: [
        {
          column: "match_name",
          operator: "not_empty" as const,
        },
      ],
    },
    {
      label: "Candidats identifiés",
      value: formatInteger(
        summary.identifiedRowCount,
      ),
      detail: formatPercent(
        summary.identificationRate,
      ),
      icon: Microscope,
      filters: [
        {
          column: "match_name",
          operator: "not_empty" as const,
        },
      ],
    },
    {
      label: "Molécules distinctes",
      value: formatInteger(
        summary.distinctMoleculeCount,
      ),
      detail: "Noms de correspondance uniques",
      icon: FlaskConical,
      filters: [
        {
          column: "match_name",
          operator: "not_empty" as const,
        },
      ],
    },
    {
      label: "Score global médian",
      value: formatScore(
        summary.medianGlobalScore,
      ),
      detail: "Sur les scores renseignés",
      icon: Gauge,
      filters: [
        {
          column: "global_score",
          operator: "not_null" as const,
        },
      ],
    },
    {
      label: "Échantillons",
      value: formatInteger(
        summary.sampleCount,
      ),
      detail: "Déduits de la colonne samples",
      icon: Database,
      filters: [],
    },
  ];

  const maximumConfidenceFeatures =
    Math.max(
      1,
      ...summary.confidenceDistribution.map(
        (entry) => entry.featureCount,
      ),
    );

  return (
    <div className="identification-summary">
      <div className="identification-summary-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <button
              type="button"
              className={
                metric.filters.length > 0
                  ? (
                      "identification-metric " +
                      "is-clickable"
                    )
                  : "identification-metric"
              }
              key={metric.label}
              disabled={metric.filters.length === 0}
              title={
                metric.filters.length > 0
                  ? (
                      "Afficher les lignes correspondantes " +
                      "dans la table complète"
                    )
                  : undefined
              }
              onClick={() => {
                if (metric.filters.length > 0) {
                  onShowFilteredFeatures(
                    metric.filters,
                  );
                }
              }}
            >
              <div className="identification-metric-icon">
                <Icon size={19} />
              </div>

              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </button>
          );
        })}
      </div>

      <article className="confidence-summary">
        <header>
          <div>
            <h4>
              Répartition des niveaux de confiance
            </h4>
            <p>
              Nombre de features uniques par niveau.
            </p>
          </div>
        </header>

        {summary.confidenceDistribution.length === 0 ? (
          <div className="scientific-results-empty">
            Aucun niveau de confiance renseigné.
          </div>
        ) : (
          <div className="confidence-bars">
            {summary.confidenceDistribution.map(
              (entry) => (
                <button
                  type="button"
                  className="confidence-row"
                  key={entry.confidenceLevel}
                  title={
                    "Afficher uniquement les résultats " +
                    `de niveau ${entry.confidenceLevel}`
                  }
                  onClick={() =>
                    onShowFilteredFeatures([
                      {
                        column: "confidence_level",
                        operator: "eq",
                        value:
                          entry.confidenceLevel,
                      },
                    ])
                  }
                >
                  <span>
                    Niveau {entry.confidenceLevel}
                  </span>

                  <div className="confidence-track">
                    <div
                      className="confidence-value"
                      style={{
                        width: `${
                          (
                            entry.featureCount /
                            maximumConfidenceFeatures
                          ) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <strong>
                    {formatInteger(
                      entry.featureCount,
                    )}{" "}
                    features
                  </strong>

                  <small>
                    {formatInteger(
                      entry.rowCount,
                    )}{" "}
                    candidat(s)
                  </small>
                </button>
              ),
            )}
          </div>
        )}
      </article>

      <article className="sample-summary">
        <header>
          <div>
            <h4>Indicateurs par échantillon</h4>
            <p>
              Features uniques, identifications et score
              médian pour chaque échantillon.
            </p>
          </div>
        </header>

        {summary.sampleStatistics.length === 0 ? (
          <div className="scientific-results-empty">
            Aucune statistique par échantillon.
          </div>
        ) : (
          <div className="sample-summary-scroll">
            <table>
              <thead>
                <tr>
                  <th>Échantillon</th>
                  <th>Features</th>
                  <th>Identifiées</th>
                  <th>Taux</th>
                  <th>Candidats</th>
                  <th>Score médian</th>
                </tr>
              </thead>

              <tbody>
                {summary.sampleStatistics.map(
                  (sample) => (
                    <tr key={sample.sampleName}>
                      <td>{sample.sampleName}</td>
                      <td>
                        {formatInteger(
                          sample.uniqueFeatureCount,
                        )}
                      </td>
                      <td>
                        {formatInteger(
                          sample.identifiedFeatureCount,
                        )}
                      </td>
                      <td>
                        {formatPercent(
                          sample.featureIdentificationRate,
                        )}
                      </td>
                      <td>
                        {formatInteger(
                          sample.identifiedRowCount,
                        )}
                      </td>
                      <td>
                        {formatScore(
                          sample.medianGlobalScore,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
