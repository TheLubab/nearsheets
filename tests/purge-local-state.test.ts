import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { purgeLocalState } from '../src/app/purge-local-state';

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

it('removes saved databases and browser preferences, caches, workers and cookies', async () => {
  const browser = browserState();
  for (const name of ['near-sheets', 'trezu-sheets', 'wallet-state']) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
  }
  await purgeLocalState();
  expect(await indexedDB.databases()).toEqual([]);
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

it('clears records even when a surviving connection blocks deleting the database', async () => {
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
  } finally { database.close(); }
});
