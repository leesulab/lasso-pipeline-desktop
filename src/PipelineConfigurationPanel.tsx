import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Download,
  Settings2,
  Upload,
} from "lucide-react";
import type {
  ConfigurationValidationResult,
  PipelineConfiguration,
  PipelineParameterSchema,
  PipelinePreset,
  PipelinePresetValidationResult,
  PipelineSchema,
} from "./api";
import {
  exportPipelinePresetFile,
  importPipelinePresetFile,
} from "./pipelinePresetFileActions";
import {
  createExportedPreset,
  presetFilename,
} from "./pipelinePresetUtils";
import "./PipelineConfigurationPanel.css";

type ParameterValue = boolean | number | string;

type PipelineConfigurationPanelProps = {
  schema: PipelineSchema | null;
  configuration: PipelineConfiguration;
  presets: PipelinePreset[];
  activePresetId: string | null;
  presetValidation:
    PipelinePresetValidationResult | null;
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
  onApplyPreset: (preset: PipelinePreset) => void;
  onImportPreset: (
    presetDocument: Record<string, unknown>,
  ) => Promise<PipelinePresetValidationResult>;
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
  presets,
  activePresetId,
  presetValidation,
  validation,
  loading,
  validating,
  error,
  onParameterChange,
  onResetParameter,
  onResetSection,
  onResetAll,
  onApplyPreset,
  onImportPreset,
  onValidate,
}: PipelineConfigurationPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    null,
  );

  const [presetImportPending, setPresetImportPending] =
    useState(false);

  async function handleImportPreset() {
    if (presetImportPending) {
      return;
    }

    setPresetImportPending(true);

    try {
      const presetDocument =
        await importPipelinePresetFile();

      if (presetDocument !== null) {
        await onImportPreset(presetDocument);
      }
    } finally {
      setPresetImportPending(false);
    }
  }

  const [presetExportPending, setPresetExportPending] =
    useState(false);

  const [presetActionMessage, setPresetActionMessage] =
    useState<string | null>(null);

  async function handleExportPreset() {
    if (
      presetExportPending ||
      validating ||
      !schema
    ) {
      return;
    }

    setPresetExportPending(true);
    setPresetActionMessage(null);

    try {
      const validationResult = await onValidate();

      if (!validationResult.valid) {
        return;
      }

      const activePreset = presets.find(
        (preset) =>
          preset.id === activePresetId,
      );

      const presetName =
        activePreset?.name ??
        "Configuration personnalisée";

      const presetDocument = createExportedPreset(
        presetName,
        activePreset?.description ?? "",
        validationResult.configuration,
        schema.version,
      );

      const destination =
        await exportPipelinePresetFile(
          presetDocument,
          presetFilename(presetName),
        );

      if (destination) {
        setPresetActionMessage(
          `Preset exporté vers ${destination}`,
        );
      }
    } finally {
      setPresetExportPending(false);
    }
  }

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

        <div className="pipeline-preset-selector">
          <label htmlFor="pipeline-preset-select">
            Preset
          </label>

          <select
            id="pipeline-preset-select"
            value={activePresetId ?? ""}
            onChange={(event) => {
              const preset = presets.find(
                (item) =>
                  item.id === event.target.value,
              );

              if (preset) {
                onApplyPreset(preset);
              }
            }}
          >
            <option value="" disabled>
              Configuration personnalisée
            </option>

            {presets.map((preset) => (
              <option
                value={preset.id ?? preset.name}
                key={preset.id ?? preset.name}
              >
                {preset.name}
              </option>
            ))}
          </select>

          {activePresetId && (
            <small>
              {
                presets.find(
                  (preset) =>
                    preset.id === activePresetId,
                )?.description
              }
            </small>
          )}

          <button
            type="button"
            className="pipeline-preset-import"
            disabled={presetImportPending || validating}
            onClick={() => void handleImportPreset()}
          >
            <Upload size={14} />
            {presetImportPending
              ? "Import en cours…"
              : "Importer un preset JSON"}
          </button>

          <button
            type="button"
            className="pipeline-preset-import"
            disabled={
              presetExportPending ||
              validating
            }
            onClick={() => void handleExportPreset()}
          >
            <Download size={14} />
            {presetExportPending
              ? "Export en cours…"
              : "Exporter la configuration"}
          </button>

          {presetActionMessage && (
            <small className="pipeline-preset-success">
              {presetActionMessage}
            </small>
          )}
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

        {presetValidation &&
          !presetValidation.valid && (
            <div className="pipeline-config-validation is-invalid">
              <AlertTriangle size={18} />
              <div>
                <strong>Preset invalide</strong>
                <ul>
                  {presetValidation.errors.map(
                    (presetError) => (
                      <li key={presetError}>
                        {presetError}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          )}

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
