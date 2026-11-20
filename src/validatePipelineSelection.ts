import type { SelectedPipelineFiles } from "./fileSelection";

export function validatePipelineSelection(
  selectedSteps: string[],
  selectedFiles: SelectedPipelineFiles,
): string[] {
  const errors: string[] = [];
  const selected = new Set(selectedSteps);

  if (
    selected.has("calibration") &&
    !selectedFiles.calibration
  ) {
    errors.push(
      "Sélectionnez le fichier CCS_calibration_data.csv.",
    );
  }

  if (
    selected.has("identification") &&
    !selectedFiles.database
  ) {
    errors.push(
      "Sélectionnez la base d’identification H5 ou HDF5.",
    );
  }

  if (selected.has("samples")) {
    const calibrationMissing =
      !selectedFiles.calibration;
    const samplesMissing =
      selectedFiles.samples.length === 0;

    if (calibrationMissing && samplesMissing) {
      errors.push(
        "Le traitement des échantillons nécessite deux types de fichiers : " +
          "le fichier de calibration CCS au format CSV et au moins un " +
          "fichier échantillon au format Parquet.",
      );
    } else if (calibrationMissing) {
      errors.push(
        "Le fichier de calibration CCS au format CSV est nécessaire " +
          "pour traiter les échantillons.",
      );
    } else if (samplesMissing) {
      errors.push(
        "Au moins un fichier échantillon au format Parquet est nécessaire " +
          "pour lancer le traitement.",
      );
    }
  }

  if (
    selected.has("feature_alignment") &&
    selected.has("samples") &&
    selectedFiles.samples.length === 0
  ) {
    errors.push(
      "L’alignement demandé après samples nécessite des fichiers échantillons.",
    );
  }

  return [...new Set(errors)];
}
