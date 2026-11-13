import { useLayoutEffect, useRef, useState } from 'react';
import { createBlankWorkbook } from '../features/documents/application/document-workspace';
import { createWorkbookSession } from '../features/spreadsheet/univer/create-workbook-session';
import type { WorkbookSession } from '../features/spreadsheet/univer/create-workbook-session';

/** Decorative grid: paint immediately, without waiting for editable-session readiness. */
export function HomeTablePreview({ onReady }: { onReady(ready: boolean): void }) {
  const host = useRef<HTMLDivElement>(null);
  const [snapshot] = useState(() => createBlankWorkbook());
  useLayoutEffect(() => {
    if (!host.current) return;
    let session: WorkbookSession;
    try { session = createWorkbookSession({ container: host.current, initialWorkbook: snapshot }); }
    catch {
      // A decorative background failure must not prevent using Welcome.
      host.current.replaceChildren();
      onReady(false);
      return;
    }
    // This background is inert. Univer can paint its canvas and toolbar while
    // deferred plugins initialize; it needs no ready callback or autosave bridge.
    onReady(true);
    return () => { onReady(false); session.dispose(); };
  }, [snapshot, onReady]);
  return <div className="home-table-preview" inert aria-hidden="true">
    <div className="workbook-editor"><div ref={host} className="workbook-editor__host"/></div>
  </div>;
}
