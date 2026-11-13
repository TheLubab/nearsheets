import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { localStateResetUrl, purgeLocalState } from '../src/app/purge-local-state';
import { DexieDocumentRepository, createDocumentDatabase } from '../src/features/documents/repository/dexie-document-repository';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function browserState() {
  const local = new Map([['nearsheets.welcome-dismissed', 'true']]);
  const session = new Map([['wallet', 'connected']]);
  vi.stubGlobal('localStorage', { clear: () => local.clear() });
  vi.stubGlobal('sessionStorage', { clear: () => session.clear() });
  vi.stubGlobal('location', { pathname: '/', hostname: 'localhost' });
  const unregister = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => [{ unregister }] } });
  const cacheEntries = new Set(['workbook-cache']);
  vi.stubGlobal('caches', { keys: async () => [...cacheEntries], delete: async (key: string) => cacheEntries.delete(key) });
  let cookie = 'welcome=true';
  const clearCookie = vi.fn((value: string) => { if (value.includes('Max-Age=0')) cookie = ''; });
  vi.stubGlobal('document', { get cookie() { return cookie; }, set cookie(value: string) { clearCookie(value); } });
  return { local, session, unregister, cacheEntries, clearCookie };
}

it('clears stored records and browser preferences, caches, workers and cookies', async () => {
  const browser = browserState();
  for (const name of ['near-sheets', 'trezu-sheets', 'wallet-state']) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
  }
  await purgeLocalState();
  for (const { name } of await indexedDB.databases()) {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name!);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      for (const store of [...database.objectStoreNames]) {
        const count = await new Promise<number>((resolve, reject) => {
          const request = database.transaction(store).objectStore(store).count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        expect(count).toBe(0);
      }
    } finally { database.close(); }
  }
  expect(browser.local.size).toBe(0);
  expect(browser.session.size).toBe(0);
  expect(browser.cacheEntries.size).toBe(0);
  expect(browser.unregister).toHaveBeenCalledOnce();
  expect(browser.clearCookie).toHaveBeenCalledWith('welcome=; Max-Age=0; Path=/');
});

it('reports storage failures while still clearing the other storage types', async () => {
  const browser = browserState();
  vi.stubGlobal('localStorage', { clear: () => { throw new Error('Storage denied'); } });
  await expect(purgeLocalState()).rejects.toThrow('Storage denied');
  expect(browser.session.size).toBe(0);
  expect(browser.cacheEntries.size).toBe(0);
  expect(browser.unregister).toHaveBeenCalledOnce();
});

it('clears records with a surviving connection and allows reopening without a blocked deletion', async () => {
  browserState();
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('held-open');
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('documents', 'readwrite');
      transaction.objectStore('documents').put({ title: 'Saved workbook' }, 'workbook');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    await purgeLocalState();
    const count = await new Promise<number>((resolve, reject) => {
      const request = database.transaction('documents').objectStore('documents').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(count).toBe(0);
    const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('held-open');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    reopened.close();
  } finally { database.close(); }
});

it('returns to the homepage after purging from a spreadsheet deep link', () => {
  expect(localStateResetUrl('https://nearsheets.xyz/s/old-id?dev=true&transactionHashes=tx#receipt')).toBe('https://nearsheets.xyz/');
});

it('resets known stores without database enumeration and never leaves an invalid empty app schema', async () => {
  browserState();
  // These names must be absent so the fallback exercises native open/abort.
  await Promise.all(['near-sheets', 'trezu-sheets'].map(name => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
  const factory = indexedDB;
  vi.stubGlobal('indexedDB', { open: factory.open.bind(factory) });
  await purgeLocalState();
  vi.stubGlobal('indexedDB', factory);
  expect((await factory.databases()).map(db => db.name)).not.toContain('near-sheets');
  const repository = new DexieDocumentRepository(createDocumentDatabase());
  try { expect(await repository.list()).toEqual([]); }
  finally { repository.close(); }
});

it('clears caches even when service-worker cleanup fails', async () => {
  const browser = browserState();
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => { throw new Error('Worker cleanup failed'); } } });
  await expect(purgeLocalState()).rejects.toThrow('Worker cleanup failed');
  expect(browser.cacheEntries.size).toBe(0);
  expect(browser.local.size).toBe(0);
});

it('reports a stalled database instead of leaving the purge button busy forever', async () => {
  browserState();
  vi.useFakeTimers();
  vi.stubGlobal('indexedDB', { open: () => ({}), databases: async () => [] });
  try {
    const rejected = expect(purgeLocalState()).rejects.toThrow('Close other NearSheets tabs');
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
  } finally { vi.useRealTimers(); }
});
