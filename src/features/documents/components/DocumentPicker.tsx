import { useCallback, useEffect, useRef, useState } from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import { AddSquareIcon } from '@solar-icons/react/linear/add-square';
import { ClipboardListIcon } from '@solar-icons/react/linear/clipboard-list';
import { FileTextIcon } from '@solar-icons/react/linear/file-text';
import { ImportIcon } from '@solar-icons/react/linear/import';
import { MenuDotsIcon } from '@solar-icons/react/linear/menu-dots';
import { Dialog } from '../../../components/ui/dialog';
import type { DocumentWorkspace } from '../application/document-workspace';
import { useWorkspaceState } from '../application/use-workspace-state';
import type { DocumentSummary } from '../model/document-envelope';
import { spreadsheetPath } from '../application/spreadsheet-navigation';
import { useSpreadsheetImport } from './SpreadsheetImport';

export function DocumentPicker({ workspace, open, onOpenChange, onTemplates, onOpenDocument }: {
  workspace: DocumentWorkspace;
  open: boolean;
  onOpenChange(open: boolean): void;
  onTemplates(): void;
  onOpenDocument(documentId: string): Promise<boolean>;
}) {
  const state = useWorkspaceState(workspace);
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<{ kind: 'rename' | 'delete'; doc: DocumentSummary } | null>(null);
  const [name, setName] = useState('');
  const editFocus = useRef<HTMLInputElement | HTMLButtonElement | null>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const importer = useSpreadsheetImport(workspace, close);
  const disabled = busy || importer.importing;
  useEffect(() => {
    if (!open) return;
    let current = true;
    setDocuments(null); setError(null); setEditing(null);
    workspace.listDocuments().then(docs => { if (current) setDocuments(docs); }, cause => {
      if (current) setError(cause instanceof Error ? cause.message : 'Could not load spreadsheets.');
    });
    return () => { current = false; };
  }, [open, workspace, revision]);

  const run = async (task: () => Promise<boolean>, dismiss = false) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      if (await task()) {
        setEditing(null);
        if (dismiss) close();
        else setRevision(value => value + 1);
      } else setError(workspace.getState().notice?.message ?? 'Could not complete this action.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete this action.');
    } finally { locked.current = false; setBusy(false); }
  };

  return <Dialog className="spreadsheet-manager" overlayClassName="spreadsheet-manager-overlay" open={open} showClose={!!state.document} onEscapeKeyDown={event => { if (editing) { event.preventDefault(); setEditing(null); } }} onOpenChange={next => { if (!disabled && (next || workspace.getState().document)) onOpenChange(next); }} title="Spreadsheets manager">
    <div className="spreadsheet-manager__actions">
      <button className="spreadsheet-manager__choice" disabled={disabled} onClick={() => void run(() => workspace.createNewDocument(), true)}>
        <AddSquareIcon size={22} aria-hidden="true"/>
        <span><strong>New spreadsheet</strong><small>Start with a blank sheet</small></span>
      </button>
      <button className="spreadsheet-manager__choice" disabled={disabled} onClick={onTemplates}>
        <ClipboardListIcon size={22} aria-hidden="true"/>
        <span><strong>Use a template</strong><small>A little head start</small></span>
      </button>
      <button className="spreadsheet-manager__choice" disabled={disabled} onClick={importer.chooseFile}>
        <ImportIcon size={22} aria-hidden="true"/>
        <span><strong>{importer.importing ? 'Importing…' : 'Import a file'}</strong><small>Bring in JSON or CSV</small></span>
      </button>
    </div>
    {importer.fileInput}
    {(error || importer.error) && <p role="alert" className="template-dialog__error">{error || importer.error} <button disabled={disabled} onClick={() => setRevision(value => value + 1)}>Reload list</button></p>}
    <div className="spreadsheet-manager__section"><h3>Local spreadsheets</h3><span role="status">{busy ? 'Working…' : 'Last edited'}</span></div>
    {documents === null ? !error && <p className="spreadsheet-manager__empty" role="status">Loading your spreadsheets…</p> : documents.length === 0 ?
      <div className="spreadsheet-manager__empty"><FileTextIcon size={28} aria-hidden="true"/><strong>A fresh start</strong><p>Spreadsheets will appear here.<br/>Create one above to get started.</p></div> :
      <ul className="spreadsheet-manager__list" aria-label="Saved spreadsheets">
        {documents.map(doc => <li key={doc.documentId} className="spreadsheet-manager__row">
          <div className="spreadsheet-manager__file">
            <span className="spreadsheet-manager__file-icon" aria-hidden="true"><FileTextIcon size={21}/></span>
            {editing?.doc.documentId === doc.documentId && editing.kind === 'rename' ?
              <form className="spreadsheet-manager__inline-rename" onSubmit={event => { event.preventDefault(); void run(() => workspace.renameSavedDocument(doc.documentId, name)); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEditing(null); } }}>
                <input ref={element => { editFocus.current = element; }} autoFocus aria-label="Spreadsheet name" value={name} disabled={disabled} onChange={event => setName(event.target.value)}/>
                <button type="submit" disabled={disabled || !name.trim()}>Save</button>
                <button type="button" disabled={disabled} onClick={() => setEditing(null)}>Cancel</button>
              </form> : <a className="spreadsheet-manager__open" href={spreadsheetPath(doc.documentId)} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={event => {
              if (disabled) { event.preventDefault(); return; }
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              void run(() => onOpenDocument(doc.documentId), true);
            }}>
              <span className="spreadsheet-manager__filename"><strong>{doc.title}</strong>{state.document?.documentId === doc.documentId && <span className="spreadsheet-manager__badge">Open</span>}</span>
              <time dateTime={doc.updatedAt}>{new Date(doc.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
            </a>}
            {editing?.doc.documentId === doc.documentId && editing.kind === 'delete' ? <div className="spreadsheet-manager__inline-delete" role="group" aria-label={`Delete ${doc.title}? This cannot be undone.`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEditing(null); } }}>
              <button className="spreadsheet-manager__delete" disabled={disabled} onClick={() => void run(() => workspace.deleteDocument(doc.documentId))}>Confirm delete</button>
              <button ref={element => { editFocus.current = element; }} autoFocus disabled={disabled} onClick={() => setEditing(null)}>Cancel</button>
            </div> : editing?.doc.documentId !== doc.documentId && <Menubar.Root className="spreadsheet-manager__row-actions">
              <Menubar.Menu>
                <Menubar.Trigger className="spreadsheet-manager__more" disabled={disabled} aria-label={`Manage ${doc.title}`}><MenuDotsIcon size={18} aria-hidden="true"/></Menubar.Trigger>
                <Menubar.Portal><Menubar.Content className="menu-content spreadsheet-manager-menu" align="end" sideOffset={4}
                  onCloseAutoFocus={event => { if (editFocus.current) { event.preventDefault(); editFocus.current.focus(); } }}>
                  <Menubar.Item className="menu-item" onSelect={() => { setEditing({ kind: 'rename', doc }); setName(doc.title); }}>Rename</Menubar.Item>
                  <Menubar.Item className="menu-item" onSelect={() => void run(() => workspace.duplicateDocument(doc.documentId), true)}>Duplicate</Menubar.Item>
                  <Menubar.Separator className="menu-separator"/>
                  <Menubar.Item className="menu-item spreadsheet-manager-menu__delete" onSelect={() => setEditing({ kind: 'delete', doc })}>Delete</Menubar.Item>
                </Menubar.Content></Menubar.Portal>
              </Menubar.Menu>
            </Menubar.Root>}
          </div>
        </li>)}
      </ul>}
    <footer className="spreadsheet-manager__footer">Saved in this browser <span aria-hidden="true">·</span> Download a backup from File to keep a copy.</footer>
  </Dialog>;
}
