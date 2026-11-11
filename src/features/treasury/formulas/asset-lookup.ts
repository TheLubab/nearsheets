import type { AssetIdentity } from "../model/action-draft";

/**
 * Asset metadata lookup for formulas.
 *
 * A formula may need a token's precision before it can state an exact amount.
 * Reading it from a service is unavoidable in general, but a naive
 * implementation issues one request per cell on every recalculation. This
 * module provides the properties a spreadsheet needs:
 *
 * - **Deduplication**: concurrent requests for the same asset share one call.
 * - **Caching**: resolved metadata is reused until its TTL expires.
 * - **Stale-result handling**: a late response for an older request never
 *   overwrites a newer one.
 * - **Explicit refresh**: the UI can invalidate a cached asset on demand.
 * - **Visible state**: `loading` / `ready` / `error` per asset for display.
 *
 * It performs no I/O itself. The network adapter is injected, so tests and the
 * default build stay offline.
 */

export type AssetLookupStatus = "idle" | "loading" | "ready" | "error";

export interface AssetLookupState {
  status: AssetLookupStatus;
  asset: AssetIdentity | null;
  error: string | null;
  /** Set when a refresh was requested while a request was in flight. */
  refreshing: boolean;
}

export interface AssetMetadataSource {
  /**
   * Resolves metadata for an asset id. Return `null` when the asset is
   * unknown; throw for a transient failure so the caller can show an error.
   */
  fetchAsset(assetId: string): Promise<AssetIdentity | null>;
}

export interface AssetLookupOptions {
  source: AssetMetadataSource;
  /** Cache lifetime. `0` disables caching of successful results. */
  ttlMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface AssetLookup {
  /** Resolves metadata, joining an in-flight request when possible. */
  get(assetId: string): Promise<AssetIdentity | null>;
  /** Current state for one asset, or `null` if it was never requested. */
  stateFor(assetId: string): AssetLookupState | null;
  /** Drops cached metadata and reloads on the next `get`. */
  refresh(assetId: string): void;
  /** Subscribes to state changes, for a loading/error indicator. */
  subscribe(listener: (assetId: string) => void): () => void;
  /** Releases listeners; in-flight results are ignored afterwards. */
  dispose(): void;
}

interface CacheEntry {
  asset: AssetIdentity;
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function createAssetLookup(options: AssetLookupOptions): AssetLookup {
  const { source, ttlMs = DEFAULT_TTL_MS, now = Date.now } = options;

  const cache = new Map<string, CacheEntry>();
  const states = new Map<string, AssetLookupState>();
  const inFlight = new Map<string, Promise<AssetIdentity | null>>();
  /** Monotonic request counter per asset, used to ignore stale replies. */
  const requestIds = new Map<string, number>();
  const listeners = new Set<(assetId: string) => void>();
  let disposed = false;

  const emit = (assetId: string) => {
    if (disposed) {
      return;
    }
    for (const listener of listeners) {
      listener(assetId);
    }
  };

  const setState = (assetId: string, next: Partial<AssetLookupState>) => {
    const previous: AssetLookupState =
      states.get(assetId) ?? {
        status: "idle",
        asset: null,
        error: null,
        refreshing: false,
      };
    states.set(assetId, { ...previous, ...next });
    emit(assetId);
  };

  const load = (assetId: string, refreshing: boolean): Promise<AssetIdentity | null> => {
    const requestId = (requestIds.get(assetId) ?? 0) + 1;
    requestIds.set(assetId, requestId);
    setState(assetId, {
      status: states.get(assetId)?.asset ? "ready" : "loading",
      error: null,
      refreshing,
    });

    const request = source
      .fetchAsset(assetId)
      .then((asset) => {
        if (disposed || requestIds.get(assetId) !== requestId) {
          // A newer request superseded this one; keep the newer state.
          return null;
        }
        if (asset) {
          cache.set(assetId, { asset, fetchedAt: now() });
          setState(assetId, {
            status: "ready",
            asset,
            error: null,
            refreshing: false,
          });
        } else {
          setState(assetId, {
            status: "error",
            asset: null,
            error: `Unknown asset "${assetId}".`,
            refreshing: false,
          });
        }
        return asset;
      })
      .catch((cause: unknown) => {
        if (disposed || requestIds.get(assetId) !== requestId) {
          return null;
        }
        setState(assetId, {
          status: "error",
          asset: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Asset metadata could not be loaded.",
          refreshing: false,
        });
        return null;
      })
      .finally(() => {
        if (inFlight.get(assetId) === request) {
          inFlight.delete(assetId);
        }
      });

    inFlight.set(assetId, request);
    return request;
  };

  return {
    get: (assetId: string) => {
      const key = assetId.trim();
      if (key.length === 0) {
        return Promise.resolve(null);
      }
      const cached = cache.get(key);
      if (cached && (ttlMs === 0 ? false : now() - cached.fetchedAt < ttlMs)) {
        return Promise.resolve(cached.asset);
      }
      const pending = inFlight.get(key);
      if (pending) {
        return pending;
      }
      return load(key, false);
    },
    stateFor: (assetId: string) => states.get(assetId.trim()) ?? null,
    refresh: (assetId: string) => {
      const key = assetId.trim();
      if (key.length === 0) {
        return;
      }
      cache.delete(key);
      // A refresh supersedes an in-flight request deliberately: the user asked
      // for current data, and the request counter makes the older reply a
      // no-op when it eventually arrives.
      void load(key, true);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      disposed = true;
      listeners.clear();
      inFlight.clear();
      requestIds.clear();
      cache.clear();
      states.clear();
    },
  };
}

/**
 * Offline default source.
 *
 * Native NEAR is the only asset this application knows without a provider.
 * Everything else resolves to `null` (an explicit "unknown") rather than a
 * guessed precision, so a formula that needs it shows a clear error instead of
 * producing a wrong amount. A later task supplies a real provider when its
 * configuration exists; until then nothing contacts a network.
 */
export function createStaticAssetSource(
  entries: AssetIdentity[] = [],
): AssetMetadataSource {
  const known = new Map<string, AssetIdentity>();
  known.set("near", { assetId: "near", symbol: "NEAR", decimals: 24 });
  for (const entry of entries) {
    known.set(entry.assetId, entry);
  }
  return {
    fetchAsset: async (assetId) =>
      known.get(assetId.trim()) ?? null,
  };
}