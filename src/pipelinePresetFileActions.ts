import { open } from "@tauri-apps/plugin-dialog";
import { readPipelinePreset } from "./backend";

function normalizeSelection(
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

export async function importPipelinePresetFile():
Promise<Record<string, unknown> | null> {
  const selection = await open({
    title: "Importer un preset LASSO",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Preset de configuration JSON",
        extensions: ["json"],
      },
    ],
  });

  const filePath = normalizeSelection(selection);

  if (!filePath) {
    return null;
  }

  const content = await readPipelinePreset(filePath);

  let document: unknown;

  try {
    document = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Le fichier sélectionné n'est pas un JSON valide : ${String(
        error,
      )}`,
    );
  }

  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document)
  ) {
    throw new Error(
      "Le preset JSON doit contenir un objet à sa racine.",
    );
  }

  return document as Record<string, unknown>;
}

import { save } from "@tauri-apps/plugin-dialog";
import { writePipelinePreset } from "./backend";

export async function exportPipelinePresetFile(
  presetDocument: Record<string, unknown>,
  suggestedFilename: string,
): Promise<string | null> {
  const destination = await save({
    title: "Exporter le preset LASSO",
    defaultPath: suggestedFilename,
    filters: [
      {
        name: "Preset de configuration JSON",
        extensions: ["json"],
      },
    ],
  });

  if (!destination) {
    return null;
  }

  const content =
    JSON.stringify(presetDocument, null, 2) + "\n";

  await writePipelinePreset(
    destination,
    content,
  );

  return destination;
}
