import { useRef, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import type { DocumentWorkspace } from '../documents/application/document-workspace';
import { WORKBOOK_TEMPLATES } from './catalog';
import type { TemplateId } from './catalog';

export function TemplateDialogs({ workspace, view, onViewChange }: {
  workspace: DocumentWorkspace;
  view: 'welcome' | 'templates' | null;
  onViewChange(view: 'welcome' | 'templates' | null): void;
}) {
  const busy = useRef(false);
  const [creating, setCreating] = useState<TemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = async (id: TemplateId) => {
    if (busy.current) return;
    busy.current = true; setCreating(id); setError(null);
    try {
      if (await workspace.createFromTemplate(id)) onViewChange(null);
      else setError(workspace.getState().notice?.message ?? 'The nearsheet could not be created. Try again.');
    } finally { busy.current = false; setCreating(null); }
  };
  // Keep focus contained while welcome transitions to the picker.
  return <Dialog open={view !== null} onOpenChange={open => {
    if (!open && !busy.current) { setError(null); onViewChange(null); }
  }} title={view === 'welcome' ? 'Welcome to NearSheets' : 'Nearsheet templates'}
    description={view === 'welcome' ? 'Start with an editable guide, choose an example, or explore a blank nearsheet. No wallet required.' : 'Each choice creates a fresh local nearsheet. Your existing work stays saved.'}
    className={view === 'templates' ? 'templates-dialog' : undefined} showClose={!creating}>
    {view === 'welcome' ? <div className="welcome-choices">
      <button className="primary-button" disabled={!!creating} onClick={() => void create('getting-started')}>Get started</button>
      <button disabled={!!creating} onClick={() => { setError(null); onViewChange('templates'); }}>Use a template</button>
      <button disabled={!!creating} onClick={() => onViewChange(null)}>Blank nearsheet</button>
    </div> : <div className="template-list">{WORKBOOK_TEMPLATES.filter(t => t.id !== 'getting-started').map(template => <article key={template.id} className="template-choice">
      <h3>{template.name}</h3><p>{template.description}</p>
      <table className="template-preview" aria-label={`${template.name} layout preview`}><tbody>{template.preview.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value || '—'}</td>)}</tr>)}</tbody></table>
      <button disabled={!!creating} onClick={() => void create(template.id)}>Use template<span className="sr-only">: {template.name}</span></button>
    </article>)}</div>}
    {creating && <p role="status">Creating nearsheet…</p>}
    {error && <p role="alert">{error}</p>}
  </Dialog>;
}
