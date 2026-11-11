import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { DocumentWorkspace } from "../application/document-workspace";
import type { WorkspaceState } from "../application/document-workspace";
import { documentFileName } from "../interchange/json";
import { downloadTextFile, importFileKind, readTextFile } from "../io/browser-files";

interface DocumentBarProps {
  workspace: DocumentWorkspace;
  state: WorkspaceState;
}

function formatSavedAt(iso: string | null): string {
  if (!iso) {
    return "Not saved yet";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }
  return `Saved ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Document-level actions, deliberately separate from the sheet surface:
 * saving is automatic, while new/rename/export/import are explicit.
 */
export function DocumentBar({ workspace, state }: DocumentBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const document = state.document;

  const saveLabel =
    state.saveStatus === "saving"
      ? "Saving…"
      : state.saveStatus === "error"
        ? "Save failed"
        : formatSavedAt(state.savedAt);

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = renameValue.trim();
    if (title.length === 0) {
      // renameDocument rejects empty titles; keep the form open to correct it.
      return;
    }
    await workspace.rename(title);
    setIsRenaming(false);
  };

  const handleExportJson = async () => {
    const json = await workspace.exportJson();
    if (!json || !document) {
      return;
    }
    downloadTextFile(
      documentFileName(document.title, "json"),
      json,
      "application/json",
    );
  };

  const handleExportCsv = async () => {
    const exported = await workspace.exportCsv();
    if (!exported) {
      return;
    }
    downloadTextFile(exported.fileName, exported.csv, "text/csv");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow choosing the same file again after a failed import.
    event.target.value = "";
    if (!file) {
      return;
    }

    const kind = importFileKind(file.name);
    if (!kind) {
      workspace.reportError(
        "Choose a Trezu Sheets .json document or a .csv file to import.",
      );
      return;
    }
    try {
      const text = await readTextFile(file);
      if (kind === "json") {
        await workspace.importJson(text);
      } else {
        await workspace.importCsv(text, file.name);
      }
    } catch (cause) {
      // File reading errors are distinct from document validation errors.
      workspace.reportError(
        cause instanceof Error ? cause.message : "The selected file could not be read.",
      );
    }
  };

  return (
    <div className="document-bar">
      <div className="document-bar__identity">
        {isRenaming ? (
          <form className="document-bar__rename" onSubmit={handleRename}>
            <input
              autoFocus
              aria-label="Document title"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={(event) => {
                // Clicking Save blurs the input first; let the submit win.
                if (event.currentTarget.form?.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setIsRenaming(false);
              }}
            />
            <button type="submit">Save</button>
          </form>
        ) : (
          <button
            type="button"
            className="document-bar__title"
            title="Rename this document"
            onClick={() => {
              setRenameValue(document?.title ?? "");
              setIsRenaming(true);
            }}
            disabled={!document}
          >
            {document?.title ?? "Opening document…"}
          </button>
        )}
        <span
          className={`document-bar__save document-bar__save--${state.saveStatus}`}
          role="status"
          aria-live="polite"
          title={state.saveStatus === "error" ? (state.saveError ?? undefined) : undefined}
        >
          {saveLabel}
        </span>
      </div>

      <div className="document-bar__actions">
        <button type="button" onClick={() => void workspace.createNewDocument()}>
          New
        </button>
        <button type="button" onClick={handleImportClick}>
          Import…
        </button>
        <button type="button" onClick={() => void handleExportJson()} disabled={!document}>
          Export JSON
        </button>
        <button type="button" onClick={() => void handleExportCsv()} disabled={!document}>
          Export CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="document-bar__file"
          onChange={(event) => void handleFileChosen(event)}
        />
      </div>

      {state.notice ? (
        <div
          className={`document-bar__notice document-bar__notice--${state.notice.kind}`}
          role={state.notice.kind === "error" ? "alert" : "status"}
        >
          <span>{state.notice.message}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => workspace.dismissNotice()}
          >
            ×
          </button>
        </div>
      ) : null}

      {state.saveStatus === "error" && state.saveError ? (
        <p className="document-bar__error" role="alert">
          {state.saveError} Use Export JSON to keep a copy.
        </p>
      ) : null}
    </div>
  );
}