import type { DocumentWorkspace } from './document-workspace';

export type SpreadsheetRoute = { kind: 'home' } | { kind: 'spreadsheet'; documentId: string } | { kind: 'invalid' };
export function spreadsheetPath(documentId: string): string {
  return `/s/${encodeURIComponent(documentId)}`;
}
export function parseSpreadsheetRoute(path: string): SpreadsheetRoute {
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === '/' || pathname === '/index.html') return { kind: 'home' };
  const match = /^\/s\/([^/]+)\/?$/.exec(pathname ?? '');
  if (!match) return { kind: 'invalid' };
  try {
    const documentId = decodeURIComponent(match[1]!);
    return documentId.trim() ? { kind: 'spreadsheet', documentId } : { kind: 'invalid' };
  } catch { return { kind: 'invalid' }; }
}

export interface NavigationHost {
  path(): string;
  push(path: string): void;
  replace(path: string): void;
  listen(listener: () => void): () => void;
}
export function browserNavigationHost(): NavigationHost {
  return {
    path: () => location.pathname + location.search + location.hash,
    push: path => history.pushState(null, '', path),
    replace: path => history.replaceState(null, '', path),
    listen: listener => {
      window.addEventListener('popstate', listener);
      return () => window.removeEventListener('popstate', listener);
    },
  };
}
export interface SpreadsheetNavigationState {
  status: 'loading' | 'ready';
  route: SpreadsheetRoute;
  error: { kind: 'missing' | 'storage' | 'invalid'; message: string } | null;
}

/** Serializes history navigation; calculation and wallet capabilities stay in the workspace. */
export function createSpreadsheetNavigation(workspace: DocumentWorkspace, host: NavigationHost) {
  let state: SpreadsheetNavigationState = { status: 'loading', route: parseSpreadsheetRoute(host.path()), error: null };
  const listeners = new Set<() => void>();
  const publish = (next: SpreadsheetNavigationState) => {
    if (disposed) return;
    state = next;
    for (const listener of listeners) listener();
  };
  let disposed = false;
  let version = 0;
  let tail: Promise<void> = Promise.resolve();
  let startPromise: Promise<void> | null = null;
  let stopHistory: (() => void) | undefined;
  let stopWorkspace: (() => void) | undefined;
  let observedId = workspace.getState().document?.documentId ?? null;

  const currentPath = () => {
    const id = workspace.getState().document?.documentId;
    return id ? spreadsheetPath(id) : '/';
  };
  const change = (path: string, mode: 'initial' | 'pop' | 'push'): Promise<void> => {
    const request = ++version;
    const route = parseSpreadsheetRoute(path);
    publish({ ...state, status: 'loading' });
    tail = tail.then(async () => {
      if (disposed || request !== version) return;
      await workspace.start();
      if (disposed || request !== version) return;
      let error: SpreadsheetNavigationState['error'] = route.kind === 'invalid'
        ? { kind: 'invalid', message: 'This link does not point to a spreadsheet.' } : null;
      const opened = route.kind === 'spreadsheet'
        ? await workspace.openSavedDocument(route.documentId) : await workspace.closeDocument();
      if (disposed || request !== version) return;
      if (!opened) {
        const notice = workspace.getState().notice;
        if (route.kind === 'spreadsheet') {
          error = { kind: notice?.code === 'document-not-found' ? 'missing' : 'storage', message: notice?.message ?? 'This spreadsheet could not be opened.' };
          // A missing link must not leave a different file visible underneath it.
          // Failed saves retain the editor and restore its matching address instead.
          if (await workspace.closeDocument()) {
            if (disposed || request !== version) return;
            if (mode === 'push' && host.path() !== path) host.push(path);
            publish({ status: 'ready', route, error });
            return;
          }
        }
        if (disposed || request !== version) return;
        const actualPath = currentPath();
        host.replace(actualPath);
        publish({ status: 'ready', route: parseSpreadsheetRoute(actualPath), error: null });
        return;
      }
      if (mode === 'push' && host.path() !== path) host.push(path);
      publish({ status: 'ready', route, error });
    });
    return tail;
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => {
      if (startPromise) return startPromise;
      stopWorkspace = workspace.subscribe(() => {
        const id = workspace.getState().document?.documentId ?? null;
        if (id === observedId) return;
        observedId = id;
        if (disposed || state.status === 'loading') return;
        const path = currentPath();
        if (host.path() !== path) host.push(path);
        publish({ status: 'ready', route: parseSpreadsheetRoute(path), error: null });
      });
      stopHistory = host.listen(() => { void change(host.path(), 'pop'); });
      startPromise = change(host.path(), 'initial');
      return startPromise;
    },
    goHome: () => change('/', 'push'),
    openDocument: async (id: string) => {
      await change(spreadsheetPath(id), 'push');
      return state.status === 'ready' && !state.error && state.route.kind === 'spreadsheet' && state.route.documentId === id;
    },
    whenIdle: () => tail,
    dispose: () => { disposed = true; version++; stopHistory?.(); stopWorkspace?.(); listeners.clear(); },
  };
}
