import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  fetchPipelineSchema,
  validatePipelineConfiguration,
  type ConfigurationValidationResult,
  type PipelineConfiguration,
  type PipelineSchema,
} from "./api";
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
      setValidation(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedSchema =
        await fetchPipelineSchema(backendStatus);

      setSchema(loadedSchema);
      setConfiguration(
        buildDefaultConfiguration(loadedSchema),
      );
      setValidation(null);
    } catch (loadError) {
      setSchema(null);
      setConfiguration({});
      setValidation(null);
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

      setValidation(null);
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
    validation,
    loading,
    validating,
    error,
    setParameter,
    resetParameter,
    resetSection,
    resetAll,
    validate,
    reload: load,
  };
}
