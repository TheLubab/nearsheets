async function clearDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error ?? new Error(`Could not open ${name}.`));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      const stores = [...database.objectStoreNames];
      if (!stores.length) { database.close(); resolve(); return; }
      try {
        const transaction = database.transaction(stores, 'readwrite');
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error(`Could not clear ${name}.`));
        };
        for (const store of stores) transaction.objectStore(store).clear();
      } catch (cause) { database.close(); reject(cause); }
    };
  });
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Could not delete ${name}.`));
    // Contents are already cleared. A surviving connection can delay removing
    // the empty schema, but must not prevent the user from resetting local data.
    request.onblocked = () => resolve();
  });
}

/** Dev-only reset. Run before mounting the app so autosave cannot restore data. */
export async function purgeLocalState() {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => localStorage.clear()),
    Promise.resolve().then(() => sessionStorage.clear()),
    Promise.resolve().then(async () => {
      const databases = await indexedDB.databases();
      await Promise.all(databases.filter(db => db.name).map(db => clearDatabase(db.name!)));
    }),
    Promise.resolve().then(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
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
