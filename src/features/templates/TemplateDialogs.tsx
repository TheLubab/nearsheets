import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AddSquareIcon } from '@solar-icons/react/linear/add-square';
import { CloseIcon } from '@solar-icons/react/linear/close';
import { ClipboardListIcon } from '@solar-icons/react/linear/clipboard-list';
import { GraphUpIcon } from '@solar-icons/react/linear/graph-up';
import { SquareAcademicCapIcon } from '@solar-icons/react/linear/square-academic-cap';
import { UserHandUpIcon } from '@solar-icons/react/linear/user-hand-up';
import { WalletMoneyIcon } from '@solar-icons/react/linear/wallet-money';
import type { ComponentType } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { DocumentWorkspace } from '../documents/application/document-workspace';
import { WORKBOOK_TEMPLATES } from './catalog';
import type { TemplateId } from './catalog';

type IconComponent = ComponentType<{ size?: number | string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
export type TemplateDialogView = 'welcome' | 'templates' | null;

/** Icons for the templates that have one. Copy comes from the catalog's own descriptions. */
const TEMPLATE_ICONS: Partial<Record<TemplateId, IconComponent>> = {
  'getting-started': SquareAcademicCapIcon,
  'account-balances': WalletMoneyIcon,
  'dao-proposals': GraphUpIcon,
  'contributor-payments': UserHandUpIcon,
};

function templateChoices() {
  return WORKBOOK_TEMPLATES.filter(t => t.id !== 'getting-started')
    .map(t => ({ template: t, icon: TEMPLATE_ICONS[t.id], summary: t.description }));
}

function Choice({ icon: Icon, title, summary, disabled, onSelect }: {
  icon?: IconComponent;
  title: string;
  summary: string;
  disabled: boolean;
  onSelect(): void;
}) {
  return <button type="button" className={`template-choice${Icon ? '' : ' template-choice--plain'}`} disabled={disabled} onClick={onSelect}>
    {Icon ? <Icon size={20} aria-hidden="true"/> : null}
    <span className="template-choice__text">
      <span className="template-choice__title">{title}</span>
      <span className="template-choice__summary">{summary}</span>
    </span>
  </button>;
}

/** Creating a spreadsheet from a template is shared by both windows. */
function useTemplateCreation(workspace: DocumentWorkspace, onCreated: () => void) {
  const [creating, setCreating] = useState<TemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const create = useCallback(async (id: TemplateId) => {
    if (busy.current) return;
    busy.current = true; setCreating(id); setError(null);
    try {
      if (await workspace.createFromTemplate(id)) onCreated();
      else setError(workspace.getState().notice?.message ?? 'The spreadsheet could not be created. Try again.');
    } finally { busy.current = false; setCreating(null); }
  }, [workspace, onCreated]);
  return { creating, error, setError, create };
}

function Shell({ open, onOpenChange, className, children, withClose }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  className: string;
  children: React.ReactNode;
  withClose: boolean;
}) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay"/>
      <DialogPrimitive.Content className={className} aria-describedby={undefined}>
        {children}
        {withClose ? <DialogPrimitive.Close className="template-dialog__close" aria-label="Close"><CloseIcon size={16}/></DialogPrimitive.Close> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

/** The welcome window: a photograph beside the three ways to start. */
export function WelcomeDialog({ workspace, open, onCreated, onUseTemplate }: {
  workspace: DocumentWorkspace;
  open: boolean;
  onCreated(): void;
  onUseTemplate(): void;
}) {
  const { creating, error, setError, create } = useTemplateCreation(workspace, onCreated);
  return <Shell open={open} onOpenChange={next => { if (!next && !creating) { setError(null); onCreated(); } }} className="welcome-dialog" withClose={!creating}>
    <div className="welcome-dialog__media">
      <img src={`${import.meta.env.BASE_URL}lavender-field.jpg`} alt="" width={1068} height={778} decoding="async"/>
    </div>
    <div className="welcome-dialog__body">
      <DialogPrimitive.Title className="welcome-dialog__title">Welcome to NearSheets</DialogPrimitive.Title>
      <p className="welcome-dialog__description">
        A spreadsheet where blockchain lives in cells. Read on-chain data, prepare transactions and reconcile results without leaving the grid.
      </p>
      <div className="template-dialog__choices">
        <Choice icon={SquareAcademicCapIcon} title="Getting started" summary="A guided tour of the basics."
          disabled={!!creating} onSelect={() => void create('getting-started')}/>
        <Choice icon={ClipboardListIcon} title="Use a template" summary="Start from a ready-made layout."
          disabled={!!creating} onSelect={() => { setError(null); onUseTemplate(); }}/>
        <Choice icon={AddSquareIcon} title="Start blank" summary="Create a new spreadsheet."
          disabled={!!creating} onSelect={onCreated}/>
      </div>
      {creating ? <p className="template-dialog__status" role="status">Creating spreadsheet…</p> : null}
      {error ? <p className="template-dialog__error" role="alert">{error}</p> : null}
    </div>
  </Shell>;
}

/** A small sheet preview makes each template recognizable before opening it. */
function TemplateCard({ template, disabled, onSelect }: {
  template: (typeof WORKBOOK_TEMPLATES)[number];
  disabled: boolean;
  onSelect(): void;
}) {
  return <button type="button" className="template-card" disabled={disabled} onClick={onSelect}>
    <span className="template-card__preview" aria-hidden="true">
      <span className="template-card__sheet">
        {template.preview.map((row, rowIndex) => <span className="template-card__row" key={rowIndex}>
          {row.map((value, columnIndex) => <span className="template-card__cell" key={columnIndex}>{value || '\u00a0'}</span>)}
        </span>)}
      </span>
    </span>
    <span className="template-card__details">
      <span className="template-card__title">{template.name}</span>
      <span className="template-card__description">{template.description}</span>
    </span>
  </button>;
}

/** The template picker keeps the same one-step creation flow as the welcome. */
export function TemplatesDialog({ workspace, open, onCreated }: {
  workspace: DocumentWorkspace;
  open: boolean;
  onCreated(): void;
}) {
  const { creating, error, setError, create } = useTemplateCreation(workspace, onCreated);
  const templates = templateChoices();
  return <Shell open={open} onOpenChange={next => { if (!next && !creating) { setError(null); onCreated(); } }} className="templates-dialog" withClose={!creating}>
    <div className="templates-dialog__body">
      <DialogPrimitive.Title className="templates-dialog__title">Start from a template</DialogPrimitive.Title>
      <p className="templates-dialog__description">Choose a starting point. You can make it your own in the spreadsheet.</p>
      <div className="templates-dialog__grid">
        {templates.map(({ template }) => <TemplateCard key={template.id} template={template}
          disabled={!!creating} onSelect={() => void create(template.id)}/>)}
      </div>
      {creating ? <p className="template-dialog__status" role="status">Creating spreadsheet…</p> : null}
      {error ? <p className="template-dialog__error" role="alert">{error}</p> : null}
    </div>
  </Shell>;
}

/** Mounts the window for the active view; each step owns its own component. */
export function TemplateDialogs({ workspace, view, onViewChange }: {
  workspace: DocumentWorkspace;
  view: TemplateDialogView;
  onViewChange(view: TemplateDialogView): void;
}) {
  const close = useCallback(() => onViewChange(null), [onViewChange]);
  return <>
    <WelcomeDialog workspace={workspace} open={view === 'welcome'} onCreated={close} onUseTemplate={() => onViewChange('templates')}/>
    <TemplatesDialog workspace={workspace} open={view === 'templates'} onCreated={close}/>
  </>;
}
