import type {
  NormalizedPipelineConfiguration,
  PipelineConfiguration,
  PipelinePreset,
  PipelineSchema,
} from "./api";

type EditableValue = boolean | number | string;

function flattenObject(
  value: Record<string, unknown>,
  prefix = "",
): Record<string, EditableValue> {
  const flattened: Record<string, EditableValue> = {};

  for (const [key, childValue] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      childValue !== null &&
      typeof childValue === "object" &&
      !Array.isArray(childValue)
    ) {
      Object.assign(
        flattened,
        flattenObject(
          childValue as Record<string, unknown>,
          path,
        ),
      );
      continue;
    }

    if (
      typeof childValue === "boolean" ||
      typeof childValue === "number" ||
      typeof childValue === "string"
    ) {
      flattened[path] = childValue;
    }
  }

  return flattened;
}

export function normalizedToEditableConfiguration(
  normalized: NormalizedPipelineConfiguration,
  schema: PipelineSchema,
): PipelineConfiguration {
  return Object.fromEntries(
    schema.sections.map((section) => {
      const flattened = flattenObject(
        normalized[section.id] ?? {},
      );

      const sectionConfiguration = Object.fromEntries(
        section.parameters.map((parameter) => [
          parameter.path,
          flattened[parameter.path] ??
            parameter.default,
        ]),
      );

      return [
        section.id,
        sectionConfiguration,
      ];
    }),
  );
}

export function createExportedPreset(
  name: string,
  description: string,
  configuration: NormalizedPipelineConfiguration,
  schemaVersion: number,
): Record<string, unknown> {
  return {
    format_version: 1,
    schema_version: schemaVersion,
    id: null,
    name: name.trim() || "Configuration personnalisée",
    description: description.trim(),
    built_in: false,
    created_at: new Date().toISOString(),
    configuration,
  };
}

export function presetFilename(
  presetName: string,
): string {
  const normalizedName = presetName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedName || "configuration-lasso"}.json`;
}

export function findDefaultPreset(
  presets: PipelinePreset[],
): PipelinePreset | null {
  return (
    presets.find(
      (preset) =>
        preset.id === "default" &&
        preset.builtIn,
    ) ?? null
  );
}
