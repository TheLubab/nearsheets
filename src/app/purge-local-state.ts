/** Return to the homepage, without stale spreadsheet IDs or callback parameters. */
export function localStateResetUrl(currentUrl: string): string {
  return new URL('/', currentUrl).href;
}

async function clearDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let database: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      database?.close();
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => {
      try { transaction?.abort(); } catch { /* The transaction may have just completed. */ }
      finish(new Error('Storage reset is waiting for another tab. Close other NearSheets tabs and try again.'));
    }, 5000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(name); }
    catch (cause) { finish(cause); return; }
    let absent = false;
    request.onupgradeneeded = event => {
      if (event.oldVersion === 0) {
        // Do not leave an empty version-1 schema where Dexie expects its stores.
        absent = true;
        database = request.result;
        request.transaction?.abort();
      }
    };
    request.onerror = () => absent ? finish() : finish(request.error ?? new Error('Could not open ' + name + '.'));
    request.onblocked = () => finish(new Error('Close other NearSheets tabs and try the reset again.'));
    request.onsuccess = () => {
      database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database?.close();
      const stores = [...database.objectStoreNames];
      if (!stores.length) { finish(); return; }
      try {
        transaction = database.transaction(stores, 'readwrite');
        transaction.oncomplete = () => finish();
        transaction.onabort = () => finish(transaction?.error ?? new Error('Could not clear ' + name + '.'));
        for (const store of stores) transaction.objectStore(store).clear();
      } catch (cause) { finish(cause); }
    };
  });
  // Clearing records is enough to reset state. deleteDatabase can remain queued
  // behind another tab and block the homepage's next attempt to open storage.
}

/** Dev-only reset. Run before mounting the app so autosave cannot restore data. */
export async function purgeLocalState() {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => localStorage.clear()),
    Promise.resolve().then(() => sessionStorage.clear()),
    Promise.resolve().then(async () => {
      const databases = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
      const names = new Set(['near-sheets', 'trezu-sheets', ...databases.flatMap(db => db.name ? [db.name] : [])]);
      await Promise.all([...names].map(clearDatabase));
    }),
    Promise.resolve().then(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    }),
    Promise.resolve().then(async () => {
      if ('caches' in globalThis) {
        await Promise.all((await caches.keys()).map(key => caches.delete(key)));
      }
    }),
    Promise.resolve().then(() => {
      // JavaScript can remove accessible cookies, but not HttpOnly cookies.
      const paths = new Set(['/', location.pathname]);
      const segments = location.pathname.split('/').filter(Boolean);
      while (segments.length) {
        const path = `/${segments.join('/')}`;
        paths.add(path); paths.add(`${path}/`); segments.pop();
      }
      const domains = location.hostname.split('.');
      const scopes = [''];
      while (domains.length) {
        scopes.push(`; Domain=${domains.join('.')}`);
        domains.shift();
      }
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.split('=')[0]?.trim();
        if (!name) continue;
        for (const path of paths) for (const scope of scopes) {
          document.cookie = `${name}=; Max-Age=0; Path=${path}${scope}`;
        }
      }
    }),
  ]);
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    throw new Error(failures.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason)).join(' '));
  }
}
