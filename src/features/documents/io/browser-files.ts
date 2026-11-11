/**
 * Browser-only file helpers for explicit export and import.
 *
 * Download/upload is a user action, not part of recalculation or autosave.
 * Keeping it here means the interchange modules stay pure and testable.
 */

/** Triggers a download of `text` under `fileName`. */
export function downloadTextFile(
  fileName: string,
  text: string,
  mimeType: string,
): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke on the next task so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Reads a user-selected file as UTF-8 text. */
export async function readTextFile(file: File): Promise<string> {
  return file.text();
}

export type ImportFileKind = "json" | "csv";

/** Determines interchange format from the extension, or `null` if unknown. */
export function importFileKind(fileName: string): ImportFileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  return null;
}