import { save } from "@tauri-apps/plugin-dialog";
import {
  exportPipelineFile,
  openPipelineFile,
} from "./backend";

function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf(".");

  if (
    lastDot <= 0 ||
    lastDot === filename.length - 1
  ) {
    return null;
  }

  return filename.slice(lastDot + 1);
}

export async function openResultFile(
  jobId: string,
  relativePath: string,
): Promise<void> {
  await openPipelineFile(
    jobId,
    relativePath,
  );
}

export async function exportResultFile(
  jobId: string,
  relativePath: string,
  filename: string,
): Promise<boolean> {
  const extension = getExtension(filename);

  const destinationPath = await save({
    title: "Exporter le fichier de résultat",
    defaultPath: filename,
    filters: extension
      ? [
          {
            name: `Fichier ${extension.toUpperCase()}`,
            extensions: [extension],
          },
        ]
      : undefined,
  });

  if (!destinationPath) {
    return false;
  }

  await exportPipelineFile(
    jobId,
    relativePath,
    destinationPath,
  );

  return true;
}
