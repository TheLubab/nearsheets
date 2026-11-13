import { useRef, useState } from 'react';
import { Dialog } from '../components/ui/dialog';
import { localStateResetUrl, purgeLocalState } from './purge-local-state';

export function DevDialog() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const purge = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError(null);
    try {
      await purgeLocalState();
      location.replace(localStateResetUrl(location.href));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local state could not be cleared. Try again.');
      running.current = false;
      setBusy(false);
    }
  };
  return <Dialog open onOpenChange={() => {}} title="Developer tools" showClose={false}
    description="Permanently delete this website’s local spreadsheets, preferences and browser storage, then reload.">
    <button type="button" disabled={busy} onClick={() => void purge()}>{busy ? 'Purging local state…' : 'Purge local state'}</button>
    {error ? <p role="alert">{error}</p> : null}
  </Dialog>;
}
