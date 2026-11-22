import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Settings2,
} from "lucide-react";
import type {
  ConfigurationValidationResult,
  PipelineConfiguration,
  PipelineParameterSchema,
  PipelineSchema,
} from "./api";
import "./PipelineConfigurationPanel.css";

type ParameterValue = boolean | number | string;

type PipelineConfigurationPanelProps = {
  schema: PipelineSchema | null;
  configuration: PipelineConfiguration;
  validation: ConfigurationValidationResult | null;
  loading: boolean;
  validating: boolean;
  error: string | null;
  onParameterChange: (
    sectionId: string,
    parameterPath: string,
    value: ParameterValue,
  ) => void;
  onResetParameter: (
    sectionId: string,
    parameterPath: string,
  ) => void;
  onResetSection: (sectionId: string) => void;
  onResetAll: () => void;
  onValidate: () => Promise<ConfigurationValidationResult>;
};

function parameterInputId(
  sectionId: string,
  parameterPath: string,
): string {
  return `pipeline-config-${sectionId}-${parameterPath}`.split(".").join("-");
}

function readValue(
  configuration: PipelineConfiguration,
  sectionId: string,
  parameter: PipelineParameterSchema,
): ParameterValue {
  const value = configuration[sectionId]?.[parameter.path];

  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  return parameter.default;
}

function ParameterControl({
  sectionId,
  parameter,
  value,
  onChange,
  onReset,
}: {
  sectionId: string;
  parameter: PipelineParameterSchema;
  value: ParameterValue;
  onChange: (value: ParameterValue) => void;
  onReset: () => void;
}) {
  const inputId = parameterInputId(sectionId, parameter.path);

  return (
    <div className="pipeline-parameter-field">
      <div className="pipeline-parameter-heading">
        <label htmlFor={inputId}>
          {parameter.label}
          {parameter.unit && (
            <span className="pipeline-parameter-unit">
              {parameter.unit}
            </span>
          )}
        </label>

        <button
          type="button"
          className="pipeline-parameter-reset"
          onClick={onReset}
          title="Rétablir la valeur par défaut"
        >
          <RotateCcw size={13} />
          Défaut
        </button>
      </div>

      {parameter.choices ? (
        <select
          id={inputId}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {parameter.choices.map((choice) => (
            <option value={choice} key={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : parameter.type === "boolean" ? (
        <label className="pipeline-boolean-control" htmlFor={inputId}>
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{Boolean(value) ? "Activé" : "Désactivé"}</span>
        </label>
      ) : parameter.type === "integer" || parameter.type === "number" ? (
        <input
          id={inputId}
          type="number"
          value={Number(value)}
          min={parameter.minimum ?? undefined}
          max={parameter.maximum ?? undefined}
          step={
            parameter.step ??
            (parameter.type === "integer" ? 1 : "any")
          }
          onChange={(event) => {
            const parsedValue =
              parameter.type === "integer"
                ? Number.parseInt(event.target.value, 10)
                : Number.parseFloat(event.target.value);

            if (!Number.isNaN(parsedValue)) {
              onChange(parsedValue);
            }
          }}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      <div className="pipeline-parameter-meta">
        <span>
          Valeur par défaut : <strong>{String(parameter.default)}</strong>
        </span>
        {parameter.description && <p>{parameter.description}</p>}
      </div>
    </div>
  );
}

export function PipelineConfigurationPanel({
  schema,
  configuration,
  validation,
  loading,
  validating,
  error,
  onParameterChange,
  onResetParameter,
  onResetSection,
  onResetAll,
  onValidate,
}: PipelineConfigurationPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      schema &&
      !schema.sections.some((section) => section.id === activeSectionId)
    ) {
      setActiveSectionId(schema.sections[0]?.id ?? null);
    }
  }, [schema, activeSectionId]);

  const activeSection = useMemo(
    () =>
      schema?.sections.find(
        (section) => section.id === activeSectionId,
      ) ?? null,
    [schema, activeSectionId],
  );

  if (loading) {
    return (
      <article className="card pipeline-config-state">
        Chargement de la configuration de la pipeline…
      </article>
    );
  }

  if (error) {
    return (
      <div className="backend-error-panel">
        <strong>Impossible de charger la configuration</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (!schema || !activeSection) {
    return (
      <article className="card pipeline-config-state">
        Démarrez le moteur local pour charger la configuration.
      </article>
    );
  }

  return (
    <section className="pipeline-config-layout">
      <aside className="card pipeline-config-navigation">
        <div className="pipeline-config-navigation-title">
          <Settings2 size={18} />
          <div>
            <strong>Configuration</strong>
            <span>{schema.sections.length} sections</span>
          </div>
        </div>

        <nav aria-label="Sections de configuration">
          {schema.sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={
                section.id === activeSection.id ? "is-active" : ""
              }
              onClick={() => setActiveSectionId(section.id)}
            >
              <span>{section.label}</span>
              <small>{section.parameters.length}</small>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="button button-secondary pipeline-config-reset-all"
          onClick={onResetAll}
        >
          <RotateCcw size={15} />
          Tout réinitialiser
        </button>
      </aside>

      <article className="card pipeline-config-editor">
        <header className="pipeline-config-editor-header">
          <div>
            <h3>{activeSection.label}</h3>
            <p>
              {activeSection.parameters.length} paramètre(s), préremplis
              avec les valeurs par défaut du moteur scientifique.
            </p>
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={() => onResetSection(activeSection.id)}
          >
            <RotateCcw size={15} />
            Réinitialiser la section
          </button>
        </header>

        <div className="pipeline-parameter-grid">
          {activeSection.parameters.map((parameter) => (
            <ParameterControl
              key={parameter.path}
              sectionId={activeSection.id}
              parameter={parameter}
              value={readValue(
                configuration,
                activeSection.id,
                parameter,
              )}
              onChange={(value) =>
                onParameterChange(
                  activeSection.id,
                  parameter.path,
                  value,
                )
              }
              onReset={() =>
                onResetParameter(activeSection.id, parameter.path)
              }
            />
          ))}
        </div>

        {validation && (
          <div
            className={
              validation.valid
                ? "pipeline-config-validation is-valid"
                : "pipeline-config-validation is-invalid"
            }
          >
            {validation.valid ? (
              <>
                <CheckCircle2 size={18} />
                <span>Configuration valide.</span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} />
                <div>
                  <strong>Configuration à corriger</strong>
                  <ul>
                    {validation.errors.map((validationError) => (
                      <li key={validationError}>{validationError}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        <footer className="pipeline-config-actions">
          <span>
            Schéma de configuration v{schema.version} · 56 valeurs
            éditables
          </span>

          <button
            type="button"
            className="button button-primary"
            disabled={validating}
            onClick={() => void onValidate()}
          >
            <CheckCircle2 size={16} />
            {validating ? "Validation…" : "Valider la configuration"}
          </button>
        </footer>
      </article>
    </section>
  );
}
