import { useRef, useState } from 'react';
import type { DocumentWorkspace } from '../application/document-workspace';
import { importFileKind, readTextFile } from '../io/browser-files';

/** Shared file chooser for the manager and File menu. */
export function useSpreadsheetImport(workspace: DocumentWorkspace, onImported?: () => void) {
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const fileInput = <input ref={input} type="file" accept=".json,.csv,application/json,text/csv" className="document-bar__file" onChange={async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy.current) return;
    busy.current = true; setImporting(true); setError(null);
    try {
      const kind = importFileKind(file.name);
      if (!kind) throw new Error('Choose a NearSheets .json or .csv file.');
      const before = workspace.getState().document?.documentId;
      const text = await readTextFile(file);
      if (kind === 'json') await workspace.importJson(text);
      else await workspace.importCsv(text, file.name);
      if (workspace.getState().document?.documentId === before) {
        throw new Error(workspace.getState().notice?.message ?? 'Could not import spreadsheet.');
      }
      onImported?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not read this file.';
      setError(message);
      if (workspace.getState().notice?.message !== message) workspace.reportError(message);
    } finally { busy.current = false; setImporting(false); }
  }}/>;
  return { fileInput, importing, error, chooseFile: () => { setError(null); input.current?.click(); } };
}
