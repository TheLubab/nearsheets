import { Dialog } from '../../../components/ui/dialog';
import type { DocumentWorkspace } from '../application/document-workspace';
import type { SpreadsheetNavigationState } from '../application/spreadsheet-navigation';
import { useSpreadsheetImport } from './SpreadsheetImport';

export function SpreadsheetLinkError({ workspace, error, onHome }: {
  workspace: DocumentWorkspace;
  error: NonNullable<SpreadsheetNavigationState['error']>;
  onHome(): void;
}) {
  const importer = useSpreadsheetImport(workspace);
  return <Dialog open onOpenChange={open => { if (!open) onHome(); }} title={error.kind === 'missing' ? 'Spreadsheet not found' : 'Spreadsheet unavailable'}>
    <p>{error.message}</p>
    {error.kind === 'missing' && <p>Links open spreadsheets saved in this browser. If you have a backup, import it to create a local copy.</p>}
    <div className="spreadsheet-link-error__actions">
      <button className="primary-button" disabled={importer.importing} onClick={onHome}>Spreadsheets manager</button>
      <button disabled={importer.importing} onClick={importer.chooseFile}>{importer.importing ? 'Importing…' : 'Import a backup'}</button>
    </div>
    {importer.fileInput}
    {importer.error && <p role="alert">{importer.error}</p>}
  </Dialog>;
}
