import { z } from 'zod';
import type { ReadEvidence } from './runtime';

export const TABLE_RESOURCE = 'nearsheets.table';

const network = z.enum(['mainnet', 'testnet']);
const readSchema = z.object({
  network,
  fetchedAt: z.iso.datetime(),
  value: z.unknown(),
  rawValue: z.unknown().optional(),
});
const keySchema = z.union([
  z.tuple([network, z.string(), z.literal('balance')]),
  z.tuple([network, z.string(), z.string(), z.record(z.string(), z.unknown())]),
  z.tuple([z.literal('intents-estimate'), z.record(z.string(), z.unknown())]),
  z.tuple([z.literal('intents-status'), z.string()]),
]);
const legacyBalance = z.object({
  account: z.string(),
  asset: z.string(),
  baseUnits: z.string().regex(/^\d+$/),
  numericValueIsApproximate: z.literal(true),
});

function parseJSON(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function restoreTableReads(data: string): Map<string, ReadEvidence> {
  const resource = z.object({ reads: z.array(z.unknown()) }).safeParse(parseJSON(data));
  const reads = new Map<string, ReadEvidence>();
  if (!resource.success) return reads;

  for (const row of resource.data.reads) {
    const entry = z.tuple([z.string(), readSchema]).safeParse(row);
    if (!entry.success) continue;
    const [key, read] = entry.data;
    const parsedKey = keySchema.safeParse(parseJSON(key));
    if (!parsedKey.success || read.value === undefined) continue;
    const [scope, target, method, args] = parsedKey.data;
    const expectedNetwork = scope === 'testnet' ? 'testnet' : 'mainnet';
    if (read.network !== expectedNetwork) continue;

    // Older snapshots stored decorated balances in the same slot as raw reads.
    const balance = legacyBalance.safeParse(read.value);
    const isNativeBalance = method === 'balance' && !args
      && balance.data?.asset === 'near' && balance.data?.account === target;
    const isTokenBalance = method === 'ft_balance_of'
      && balance.data?.asset === target && balance.data?.account === args?.account_id;
    const rawValue = read.rawValue ?? (isNativeBalance || isTokenBalance ? balance.data?.baseUnits : undefined);
    reads.set(key, { ...read, rawValue, saved: true, stale: true });
  }
  return reads;
}
