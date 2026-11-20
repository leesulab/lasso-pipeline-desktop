import { open } from "@tauri-apps/plugin-dialog";

export type SelectedPipelineFiles = {
  calibration: string | null;
  database: string | null;
  blanks: string[];
  samples: string[];
};

export const emptySelectedFiles: SelectedPipelineFiles = {
  calibration: null,
  database: null,
  blanks: [],
  samples: [],
};

function normalizeSingleSelection(
  selection: string | string[] | null,
): string | null {
  if (typeof selection === "string") {
    return selection;
  }

  if (Array.isArray(selection)) {
    return selection[0] ?? null;
  }

  return null;
}

function normalizeMultipleSelection(
  selection: string | string[] | null,
): string[] {
  if (Array.isArray(selection)) {
    return selection;
  }

  if (typeof selection === "string") {
    return [selection];
  }

  return [];
}

export async function selectCalibrationFile(): Promise<
  string | null
> {
  const selection = await open({
    title: "Sélectionner le fichier de calibration CCS",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Calibration CCS",
        extensions: ["csv"],
      },
    ],
  });

  return normalizeSingleSelection(selection);
}

export async function selectDatabaseFile(): Promise<
  string | null
> {
  const selection = await open({
    title: "Sélectionner la base d’identification",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Base d’identification HDF5",
        extensions: ["h5", "hdf5"],
      },
    ],
  });

  return normalizeSingleSelection(selection);
}

export async function selectBlankFiles(): Promise<string[]> {
  const selection = await open({
    title: "Sélectionner les fichiers blanks",
    multiple: true,
    directory: false,
    filters: [
      {
        name: "Fichiers blanks Parquet",
        extensions: ["parquet"],
      },
    ],
  });

  return normalizeMultipleSelection(selection);
}

export async function selectSampleFiles(): Promise<string[]> {
  const selection = await open({
    title: "Sélectionner les fichiers d’échantillons",
    multiple: true,
    directory: false,
    filters: [
      {
        name: "Échantillons Parquet",
        extensions: ["parquet"],
      },
    ],
  });

  return normalizeMultipleSelection(selection);
}

export function getFileName(filePath: string): string {
  const normalizedPath = filePath.split("\\").join("/");
  return normalizedPath.split("/").pop() ?? filePath;
}
