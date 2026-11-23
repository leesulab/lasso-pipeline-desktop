import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  fetchPipelinePresets,
  fetchPipelineSchema,
  validatePipelineConfiguration,
  validatePipelinePreset,
  type ConfigurationValidationResult,
  type PipelineConfiguration,
  type PipelinePreset,
  type PipelinePresetValidationResult,
  type PipelineSchema,
} from "./api";
import {
  normalizedToEditableConfiguration,
} from "./pipelinePresetUtils";
import type { BackendStatus } from "./backend";

function buildDefaultConfiguration(
  schema: PipelineSchema,
): PipelineConfiguration {
  return Object.fromEntries(
    schema.sections.map((section) => [
      section.id,
      Object.fromEntries(
        section.parameters.map((parameter) => [
          parameter.path,
          parameter.default,
        ]),
      ),
    ]),
  );
}

export function usePipelineConfiguration(
  backendStatus: BackendStatus,
) {
  const [schema, setSchema] =
    useState<PipelineSchema | null>(null);

  const [configuration, setConfiguration] =
    useState<PipelineConfiguration>({});

  const [presets, setPresets] =
    useState<PipelinePreset[]>([]);

  const [activePresetId, setActivePresetId] =
    useState<string | null>(null);

  const [presetValidation, setPresetValidation] =
    useState<PipelinePresetValidationResult | null>(
      null,
    );

  const [validation, setValidation] =
    useState<ConfigurationValidationResult | null>(
      null,
    );

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    if (!backendStatus.running) {
      setSchema(null);
      setConfiguration({});
      setPresets([]);
      setActivePresetId(null);
      setValidation(null);
      setPresetValidation(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        loadedSchema,
        loadedPresets,
      ] = await Promise.all([
        fetchPipelineSchema(backendStatus),
        fetchPipelinePresets(backendStatus),
      ]);

      setSchema(loadedSchema);
      setPresets(loadedPresets);

      const defaultPreset =
        loadedPresets.find(
          (preset) =>
            preset.id === "default" &&
            preset.builtIn,
        ) ?? null;

      setConfiguration(
        defaultPreset
          ? normalizedToEditableConfiguration(
              defaultPreset.configuration,
              loadedSchema,
            )
          : buildDefaultConfiguration(
              loadedSchema,
            ),
      );

      setActivePresetId(
        defaultPreset?.id ?? null,
      );
      setValidation(null);
      setPresetValidation(null);
    } catch (loadError) {
      setSchema(null);
      setConfiguration({});
      setPresets([]);
      setActivePresetId(null);
      setValidation(null);
      setPresetValidation(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [backendStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const setParameter = useCallback(
    (
      sectionId: string,
      parameterPath: string,
      value: boolean | number | string,
    ) => {
      setConfiguration((current) => ({
        ...current,
        [sectionId]: {
          ...current[sectionId],
          [parameterPath]: value,
        },
      }));

      setActivePresetId(null);
      setValidation(null);
      setPresetValidation(null);
    },
    [],
  );

  const resetParameter = useCallback(
    (
      sectionId: string,
      parameterPath: string,
    ) => {
      const parameter = schema?.sections
        .find(
          (section) => section.id === sectionId,
        )
        ?.parameters.find(
          (item) => item.path === parameterPath,
        );

      if (!parameter) {
        return;
      }

      setParameter(
        sectionId,
        parameterPath,
        parameter.default,
      );
    },
    [schema, setParameter],
  );

  const resetSection = useCallback(
    (sectionId: string) => {
      const section = schema?.sections.find(
        (item) => item.id === sectionId,
      );

      if (!section) {
        return;
      }

      setConfiguration((current) => ({
        ...current,
        [sectionId]: Object.fromEntries(
          section.parameters.map((parameter) => [
            parameter.path,
            parameter.default,
          ]),
        ),
      }));

      setValidation(null);
    },
    [schema],
  );

  const resetAll = useCallback(() => {
    if (!schema) {
      return;
    }

    setConfiguration(
      buildDefaultConfiguration(schema),
    );
    setValidation(null);
  }, [schema]);

  const applyPreset = useCallback(
    (preset: PipelinePreset) => {
      if (!schema) {
        return;
      }

      setConfiguration(
        normalizedToEditableConfiguration(
          preset.configuration,
          schema,
        ),
      );

      setActivePresetId(preset.id);
      setValidation(null);
      setPresetValidation(null);
    },
    [schema],
  );

  const importPreset = useCallback(
    async (
      presetDocument: Record<string, unknown>,
    ) => {
      if (!backendStatus.running || !schema) {
        throw new Error(
          "Le moteur local n'est pas disponible.",
        );
      }

      setValidating(true);
      setError(null);
      setPresetValidation(null);

      try {
        const result =
          await validatePipelinePreset(
            backendStatus,
            presetDocument,
          );

        setPresetValidation(result);

        if (result.valid && result.preset) {
          setConfiguration(
            normalizedToEditableConfiguration(
              result.preset.configuration,
              schema,
            ),
          );

          setActivePresetId(
            result.preset.id,
          );
          setValidation(null);
        }

        return result;
      } catch (presetError) {
        setError(String(presetError));
        throw presetError;
      } finally {
        setValidating(false);
      }
    },
    [backendStatus, schema],
  );

  const validate = useCallback(async () => {
    if (!backendStatus.running) {
      throw new Error(
        "Le moteur local n'est pas disponible.",
      );
    }

    setValidating(true);
    setError(null);

    try {
      const result =
        await validatePipelineConfiguration(
          backendStatus,
          configuration,
        );

      setValidation(result);
      return result;
    } catch (validationError) {
      setError(String(validationError));
      throw validationError;
    } finally {
      setValidating(false);
    }
  }, [backendStatus, configuration]);

  return {
    schema,
    configuration,
    presets,
    activePresetId,
    presetValidation,
    validation,
    loading,
    validating,
    error,
    setParameter,
    resetParameter,
    resetSection,
    resetAll,
    applyPreset,
    importPreset,
    validate,
    reload: load,
  };
}
