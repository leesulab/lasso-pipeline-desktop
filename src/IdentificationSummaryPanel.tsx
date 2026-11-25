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
} from "./api";
import "./IdentificationSummaryPanel.css";

type IdentificationSummaryPanelProps = {
  summary: IdentificationResultSummary;
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
}: IdentificationSummaryPanelProps) {
  const metrics = [
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
    },
    {
      label: "Molécules distinctes",
      value: formatInteger(
        summary.distinctMoleculeCount,
      ),
      detail: "Noms de correspondance uniques",
      icon: FlaskConical,
    },
    {
      label: "Score global médian",
      value: formatScore(
        summary.medianGlobalScore,
      ),
      detail: "Sur les scores renseignés",
      icon: Gauge,
    },
    {
      label: "Échantillons",
      value: formatInteger(
        summary.sampleCount,
      ),
      detail: "Déduits de la colonne samples",
      icon: Database,
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
            <article
              className="identification-metric"
              key={metric.label}
            >
              <div className="identification-metric-icon">
                <Icon size={19} />
              </div>

              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
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
                <div
                  className="confidence-row"
                  key={entry.confidenceLevel}
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
                </div>
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
