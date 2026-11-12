const BLOCKCHAIN_TOUR_KEY = 'nearsheets.tours.blockchain.v1';

export function createTourPreference(storage: () => Pick<Storage, 'getItem' | 'setItem'> = () => localStorage) {
  let dismissed = false;
  return {
    isDismissed() {
      if (dismissed) return true;
      try { return storage().getItem(BLOCKCHAIN_TOUR_KEY) === 'true'; }
      catch { return false; }
    },
    dismiss() {
      dismissed = true;
      try { storage().setItem(BLOCKCHAIN_TOUR_KEY, 'true'); }
      catch { /* Keep this session quiet when preference storage is unavailable. */ }
    },
  };
}

export const blockchainTourPreference = createTourPreference();
