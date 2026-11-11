import { describe, expect, it, vi } from "vitest";
import type { AssetIdentity } from "../src/features/treasury/model/action-draft";
import {
  createAssetLookup,
  createStaticAssetSource,
} from "../src/features/treasury/formulas/asset-lookup";

const wnear: AssetIdentity = { assetId: "nep141:wrap.near", symbol: "wNEAR", decimals: 24 };

/** Source whose calls are controlled manually, to observe concurrency. */
function deferredSource() {
  const calls: Array<{
    assetId: string;
    resolve: (asset: AssetIdentity | null) => void;
    reject: (error: Error) => void;
  }> = [];

  return {
    calls,
    source: {
      fetchAsset: (assetId: string) =>
        new Promise<AssetIdentity | null>((resolve, reject) => {
          calls.push({ assetId, resolve, reject });
        }),
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("asset metadata lookup", () => {
  it("deduplicates concurrent requests for one asset", async () => {
    const { source, calls } = deferredSource();
    const lookup = createAssetLookup({ source });

    const first = lookup.get("nep141:wrap.near");
    const second = lookup.get("nep141:wrap.near");
    expect(calls).toHaveLength(1);

    calls[0]!.resolve(wnear);
    await expect(first).resolves.toEqual(wnear);
    await expect(second).resolves.toEqual(wnear);
    lookup.dispose();
  });

  it("reuses cached metadata within the TTL and refetches after it", async () => {
    let clock = 0;
    const source = {
      fetchAsset: vi.fn(async () => wnear),
    };
    const lookup = createAssetLookup({ source, ttlMs: 1000, now: () => clock });

    await lookup.get("nep141:wrap.near");
    await lookup.get("nep141:wrap.near");
    expect(source.fetchAsset).toHaveBeenCalledTimes(1);

    clock = 2000;
    await lookup.get("nep141:wrap.near");
    expect(source.fetchAsset).toHaveBeenCalledTimes(2);
    lookup.dispose();
  });

  it("reports progress through explicit states", async () => {
    const { source, calls } = deferredSource();
    const lookup = createAssetLookup({ source });
    const seen: string[] = [];
    lookup.subscribe((assetId) => {
      seen.push(lookup.stateFor(assetId)?.status ?? "missing");
    });

    const pending = lookup.get("nep141:wrap.near");
    expect(lookup.stateFor("nep141:wrap.near")?.status).toBe("loading");

    calls[0]!.resolve(wnear);
    await pending;
    expect(lookup.stateFor("nep141:wrap.near")).toMatchObject({
      status: "ready",
      asset: wnear,
      error: null,
    });
    expect(seen).toContain("loading");
    lookup.dispose();
  });

  it("exposes an unknown asset as an error instead of guessing precision", async () => {
    const lookup = createAssetLookup({ source: createStaticAssetSource() });
    await expect(lookup.get("nep141:unknown.near")).resolves.toBeNull();
    expect(lookup.stateFor("nep141:unknown.near")?.status).toBe("error");
    expect(lookup.stateFor("nep141:unknown.near")?.error).toMatch(/Unknown asset/);
    lookup.dispose();
  });

  it("keeps the newer result when replies arrive out of order", async () => {
    const { source, calls } = deferredSource();
    const lookup = createAssetLookup({ source });

    const first = lookup.get("asset.a");
    calls[0]!.resolve({ assetId: "asset.a", symbol: "OLD", decimals: 6 });

    // A refresh starts a second request; the first resolves after it.
    lookup.refresh("asset.a");
    await flush();
    const secondCall = calls[1]!;
    secondCall.resolve({ assetId: "asset.a", symbol: "NEW", decimals: 8 });

    await first;
    await flush();

    expect(lookup.stateFor("asset.a")?.asset?.symbol).toBe("NEW");
    lookup.dispose();
  });

  it("reports a transport failure as an error state, not a crash", async () => {
    const source = {
      fetchAsset: async () => {
        throw new Error("Network unavailable");
      },
    };
    const lookup = createAssetLookup({ source });
    await expect(lookup.get("nep141:wrap.near")).resolves.toBeNull();
    expect(lookup.stateFor("nep141:wrap.near")?.error).toBe("Network unavailable");
    lookup.dispose();
  });

  it("knows native NEAR offline and nothing else", async () => {
    const lookup = createAssetLookup({ source: createStaticAssetSource() });
    await expect(lookup.get("near")).resolves.toEqual({
      assetId: "near",
      symbol: "NEAR",
      decimals: 24,
    });
    await expect(lookup.get("nep141:wrap.near")).resolves.toBeNull();
    lookup.dispose();
  });

  it("ignores late results after disposal", async () => {
    const { source, calls } = deferredSource();
    const lookup = createAssetLookup({ source });
    const pending = lookup.get("nep141:wrap.near");
    lookup.dispose();
    calls[0]!.resolve(wnear);

    await expect(pending).resolves.toBeNull();
    expect(lookup.stateFor("nep141:wrap.near")).toBeNull();
  });
});