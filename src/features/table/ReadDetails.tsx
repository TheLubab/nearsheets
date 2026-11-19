import { z } from 'zod';
import type { ReadEvidence } from './runtime';
const balanceRead = z.object({display:z.string(),baseUnits:z.string(),decimals:z.number(),asset:z.string(),symbol:z.string(),account:z.string()});

export function ReadDetails({readKey,read}:{readKey:string;read:ReadEvidence}) {
  const balance = balanceRead.safeParse(read.value);
  const freshness = read.saved ? 'saved · stale' : read.stale||Date.now()-Date.parse(read.fetchedAt)>(readKey.includes('intents-')?5000:30_000) ? 'stale' : 'recent';
  return <details>
    <summary>{balance.success ? `${balance.data.account} · ${balance.data.symbol} · ` : ''}{read.network} · {freshness}</summary>
    {balance.success && <dl>
      <dt>Exact balance</dt><dd>{balance.data.display} {balance.data.symbol}</dd>
      <dt>Account</dt><dd>{balance.data.account}</dd>
      <dt>Token / contract</dt><dd>{balance.data.asset}</dd>
      <dt>Decimals</dt><dd>{balance.data.decimals}</dd>
      <dt>Base units</dt><dd>{balance.data.baseUnits}</dd>
    </dl>}
    <p>Last successful read: {read.fetchedAt}</p>
    <details><summary>Raw read details</summary><code>{readKey}</code><pre>{JSON.stringify(read.value,null,2)}</pre></details>
  </details>;
}
