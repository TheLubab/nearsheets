import { AboutNearSheets } from '../../../components/AboutNearSheets';
import * as Menubar from '@radix-ui/react-menubar';
import { Tooltip } from '@univerjs/design';
import type { ReactNode } from 'react';
import { FolderOpenIcon } from '@solar-icons/react/linear/folder-open';
import { DownloadIcon } from '@solar-icons/react/linear/download';
import { InfoCircleIcon } from '@solar-icons/react/linear/info-circle';
import { StarsIcon } from '@solar-icons/react/linear/stars';
import { PrinterIcon } from '@solar-icons/react/linear/printer';
import { printSheet } from '../../spreadsheet/univer/print-sheet';
import { useState } from "react";
import type { DocumentWorkspace } from "../application/document-workspace";
import type { WorkspaceState } from "../application/document-workspace";
import { documentFileName } from "../interchange/json";
import { downloadTextFile } from "../io/browser-files";

interface DocumentBarProps {
  workspace: DocumentWorkspace;
  state: WorkspaceState;
  children?:ReactNode;
  ribbonMenu?: boolean;
  onDocuments(): void;
  onWelcome(): void;
}

function formatSavedAt(iso: string | null): string {
  if (!iso) {
    return "Not saved yet";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }
  return `Saved in this browser at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Document-level actions, deliberately separate from the sheet surface:
 * saving is automatic, while new/rename/export/import are explicit.
 */
export function DocumentBar({ workspace, state, children, ribbonMenu, onDocuments, onWelcome }: DocumentBarProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [aboutOpen,setAboutOpen]=useState(false);
  const document = state.document;

  const saveLabel =
    state.saveStatus === "saving"
      ? "Saving…"
      : state.saveStatus === "error"
        ? "Save failed"
        : formatSavedAt(state.savedAt);

  const handleRename = () => {
    const title = renameValue.trim();
    if (title && title !== document?.title) {
      void workspace.rename(title);
    }
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

  const handlePrint = () => {
    try {
      const sheet = workspace.getSession()?.getWorkbook()?.getActiveSheet();
      if (!sheet || !document) throw new Error('Wait for the spreadsheet to finish opening, then try printing again.');
      printSheet(sheet, document.title);
    } catch (cause) {
      workspace.reportError(cause instanceof Error ? cause.message : 'The print view could not be opened.');
    }
  };

  return <div className="document-context">
      <div className="document-bar__identity">
        {isRenaming ? (
          <div className="document-bar__rename">
            <input
              autoFocus
              aria-label="Spreadsheet title"
              value={renameValue}
              size={Math.max(8, Math.min(32, renameValue.length || 1))}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={handleRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
        ) : (
          <Tooltip title="Rename" asChild>
          <button
            type="button"
            className="document-bar__title"
            onClick={() => {
              setRenameValue(document?.title ?? "");
              setIsRenaming(true);
            }}
            disabled={!document}
          >
            {document?.title ?? "Spreadsheets manager"}
          </button>
          </Tooltip>
        )}
        <span
          className={`document-bar__save document-bar__save--${state.saveStatus}`}
          role="status"
          aria-live="polite"
          title={state.saveStatus === "error" ? (state.saveError ?? undefined) : undefined}
        >
          {document ? saveLabel : ""}
        </span>
      </div>


    <Menubar.Root className={'app-menubar'+(ribbonMenu ? ' app-menubar--ribbon' : '')}>
      <Menubar.Menu><Menubar.Trigger data-document-menu-trigger>File</Menubar.Trigger><Menubar.Portal><Menubar.Content className="menu-content" align="start" sideOffset={3}>
        <Menubar.Item className="menu-item" onSelect={onDocuments}><FolderOpenIcon size={16}/>Spreadsheets manager</Menubar.Item>
        <Menubar.Separator className="menu-separator"/>
        <Menubar.Item className="menu-item" disabled={!document} onSelect={()=>void handleExportJson()}><DownloadIcon size={16}/>Download backup (.json)</Menubar.Item>
        <Menubar.Item className="menu-item" disabled={!document} onSelect={()=>void handleExportCsv()}><DownloadIcon size={16}/>Download current sheet (.csv)</Menubar.Item>
        <Menubar.Item className="menu-item" disabled={!document || state.status !== 'ready'} onSelect={handlePrint}><PrinterIcon size={16}/>Print…</Menubar.Item>
        <Menubar.Separator className="menu-separator"/>
        <Menubar.Item className="menu-item" onSelect={onWelcome}><StarsIcon size={16}/>Welcome</Menubar.Item>
        <Menubar.Item className="menu-item" onSelect={()=>setAboutOpen(true)}><InfoCircleIcon size={16}/>About NearSheets</Menubar.Item>
      </Menubar.Content></Menubar.Portal></Menubar.Menu>
      {children}
    </Menubar.Root>
    <AboutNearSheets open={aboutOpen} onOpenChange={setAboutOpen}/>
    {state.saveStatus==='error'&&state.saveError&&<p className="document-bar__error" role="alert">{state.saveError} Download JSON from File to keep a copy.</p>}
  </div>;
}
