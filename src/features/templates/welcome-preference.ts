const WELCOME_KEY = 'nearsheets.welcome-dismissed';

/** Separate from documents; storage failure never blocks editing. */
export function createWelcomePreference(storage: () => Pick<Storage, 'getItem' | 'setItem'> = () => localStorage) {
  let dismissed = false;
  return {
    isDismissed() {
      if (dismissed) return true;
      try { return storage().getItem(WELCOME_KEY) === 'true'; }
      catch { return false; }
    },
    dismiss() {
      dismissed = true;
      try { storage().setItem(WELCOME_KEY, 'true'); }
      catch { /* Retain the dismissal for this session. */ }
    },
  };
}
