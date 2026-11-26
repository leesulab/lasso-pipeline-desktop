import {
  open,
  save,
} from "@tauri-apps/plugin-dialog";
import {
  readPipelinePreset,
  writePipelinePreset,
} from "./backend";
import {
  parseTableViewsFile,
  serializeTableViewsFile,
  type SavedTableView,
} from "./tableViews";

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

export async function exportTableViewsFile(
  userViews: SavedTableView[],
): Promise<string | null> {
  const destination = await save({
    title: "Exporter les vues tabulaires LASSO",
    defaultPath: "lasso-table-views.json",
    filters: [
      {
        name: "Vues tabulaires LASSO",
        extensions: ["json"],
      },
    ],
  });

  if (!destination) {
    return null;
  }

  const content =
    serializeTableViewsFile(userViews) + "\n";

  await writePipelinePreset(
    destination,
    content,
  );

  return destination;
}

export async function importTableViewsFile(
  existingViews: SavedTableView[],
): Promise<{
  filePath: string;
  importedViews: SavedTableView[];
} | null> {
  const selection = await open({
    title: "Importer des vues tabulaires LASSO",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Vues tabulaires LASSO",
        extensions: ["json"],
      },
    ],
  });

  const filePath = normalizeSelection(
    selection,
  );

  if (!filePath) {
    return null;
  }

  const content = await readPipelinePreset(
    filePath,
  );

  const importedViews = parseTableViewsFile(
    content,
    existingViews,
  );

  return {
    filePath,
    importedViews,
  };
}
