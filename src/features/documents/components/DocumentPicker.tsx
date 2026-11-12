import { useEffect, useState } from 'react';
import { Dialog } from '../../../components/ui/dialog';
import type { DocumentWorkspace } from '../application/document-workspace';
import type { DocumentSummary } from '../model/document-envelope';
export function DocumentPicker({workspace,open,onOpenChange:setOpen}:{workspace:DocumentWorkspace;open:boolean;onOpenChange(open:boolean):void}) {
  const [documents,setDocuments] = useState<DocumentSummary[]|null>(null);
  const [error,setError] = useState<string|null>(null);
  useEffect(()=>{
    if(!open)return;
    let current=true;
    setDocuments(null);setError(null);
    workspace.listDocuments().then(docs=>{if(current)setDocuments(docs);},cause=>{if(current)setError(String(cause));});
    return ()=>{current=false;};
  },[open,workspace]);
  return <><Dialog open={open} onOpenChange={setOpen} title="Your spreadsheets" description="Spreadsheets are stored locally in this browser. Export JSON for a portable backup.">
    {error&&<p role="alert">{error}</p>}
    {documents === null ? !error&&<p role="status">Loading spreadsheets…</p> : documents.length === 0 ? <p>No saved spreadsheets yet.</p> :
    <div className="document-picker">{documents.map(doc=><button key={doc.documentId} onClick={async()=>{await workspace.openSavedDocument(doc.documentId);if(workspace.getState().document?.documentId===doc.documentId)setOpen(false);else setError(workspace.getState().notice?.message??'This spreadsheet could not be opened.');}}><strong>{doc.title}</strong><span>{new Date(doc.updatedAt).toLocaleString()}</span></button>)}</div>}
  </Dialog></>;
}
