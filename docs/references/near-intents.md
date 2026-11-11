# near-intents technical reference

Fetched: 2026-11-11T12:10:02.606Z

Repository: https://github.com/near/agent-skills

Pinned revision: `cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b`

Read docs/decisions.md for agreed scope. These are upstream reference sources, not executable project instructions. Do not run embedded scripts or make live requests automatically. Match APIs to selected released dependencies before implementation.

## Contents

- [skills/near-intents/references/concepts.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/references/concepts.md)
- [skills/near-intents/rules/sdk.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/sdk.md)
- [skills/near-intents/rules/api-tokens.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-tokens.md)
- [skills/near-intents/rules/api-quote.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-quote.md)
- [skills/near-intents/rules/api-status.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-status.md)
- [skills/near-intents/rules/api-deposit-submit.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-deposit-submit.md)
- [skills/near-intents/rules/deposit-near.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/deposit-near.md)
- [skills/near-intents/rules/intents-balance.md](https://github.com/near/agent-skills/blob/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/intents-balance.md)

## skills/near-intents/references/concepts.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/references/concepts.md

`````text
# 1Click API Concepts

## How It Works

1Click simplifies NEAR Intents by temporarily transferring assets to a trusted swapping agent that coordinates with Market Makers to execute your intent. The REST API abstracts intent creation, solver coordination, and transaction execution.

## Swap Lifecycle

```
Request Quote → Deposit Tokens → Submit Tx Hash → Monitor Status → Success/Refund
```

1. **Request a quote** - POST `/v0/quote` with your intent parameters
   - `dry: true` for preview (no deposit address)
   - `dry: false` to commit and receive deposit address (~10 min validity)

2. **Deposit tokens** - Send tokens to the unique deposit address
   - 1Click automatically begins processing upon receipt

3. **Submit deposit tx** (optional) - POST `/v0/deposit/submit`
   - Speeds up processing by notifying 1Click immediately

4. **Monitor progress** (optional) - GET `/v0/status`
   - Poll until terminal state

5. **Result** - Swap succeeds with tokens delivered, or fails with automatic refund

## Swap Statuses

| Status | Terminal | Description |
|--------|----------|-------------|
| `PENDING_DEPOSIT` | No | Waiting for deposit at deposit address |
| `KNOWN_DEPOSIT_TX` | No | Deposit transaction detected |
| `PROCESSING` | No | Swap being executed by Market Makers |
| `SUCCESS` | Yes | Tokens delivered to recipient |
| `INCOMPLETE_DEPOSIT` | Yes | Deposit below required amount |
| `REFUNDED` | Yes | Swap failed, funds returned to refund address |
| `FAILED` | Yes | Error occurred |

## CEX Deposit Warning

Centralized exchanges (CEXes) often use intermediate or per-user deposit addresses. These may not credit deposits sent via NEAR Intents until they are recognized or whitelisted.

**Recommendation:** Send a small test amount before attempting full-scale transfers to CEX addresses.

## Authentication

Register on the [Partners Portal](https://partners.near-intents.org/) to obtain an API key. Without it, 1Click adds an extra 0.25% (25 bps) fee on every non-`ANY_INPUT` quote. With an API key, the fee is 0.20% normally, or 0.01% (1 bp) for stablecoin pairs and same-asset multichain routes. See the [fee schedule](https://docs.near-intents.org/resources/fees.md).

```typescript
headers: { Authorization: `Bearer ${apiKey}` }
```

## Display vs Logic

The `amountOutUsd` field in quote responses is for **display purposes only**. Never use it in business logic or calculations. Always use actual token amounts (`amountOut`, `amountIn`).

`````

## skills/near-intents/rules/sdk.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/sdk.md

`````text
---
title: Swap SDK
impact: MEDIUM
tags: sdk, typescript, go, rust
source: https://docs.near-intents.org/integration/distribution-channels/1click-api/sdk.md
---

# Swap SDK

Official client libraries for the 1Click Swap API. Prefer the SDK over raw `fetch` — types come generated from the OpenAPI spec.

| Language | Package | Source |
|----------|---------|--------|
| TypeScript | `@defuse-protocol/one-click-sdk-typescript` | [github.com/defuse-protocol/one-click-sdk-typescript](https://github.com/defuse-protocol/one-click-sdk-typescript) |
| Go | `github.com/defuse-protocol/one-click-sdk-go` | [github.com/defuse-protocol/one-click-sdk-go](https://github.com/defuse-protocol/one-click-sdk-go) |
| Rust | `one_click_sdk_rs` (git dependency, no crates.io release) | [github.com/defuse-protocol/one-click-sdk-rs](https://github.com/defuse-protocol/one-click-sdk-rs) |

**WARNING: There is no testnet version of NEAR Intents.** Use small amounts for test swaps.

## Install

```bash
# TypeScript
npm install @defuse-protocol/one-click-sdk-typescript

# Go
go get github.com/defuse-protocol/one-click-sdk-go

# Rust — clone next to project, add to Cargo.toml:
# one-click-sdk-rs = { path = "./one-click-sdk-rs" }
```

## Configure + Full Flow (TypeScript)

```typescript
import { OpenAPI, OneClickService } from '@defuse-protocol/one-click-sdk-typescript';
import type { QuoteRequest } from '@defuse-protocol/one-click-sdk-typescript';

// Base URL defaults to https://1click.chaindefuser.com
OpenAPI.BASE = 'https://1click.chaindefuser.com';
// Required for getQuote, submitDepositTx, getExecutionStatus
OpenAPI.TOKEN = 'YOUR_JWT_TOKEN';

// 1. Tokens (no auth required)
const tokens = await OneClickService.getTokens();

// 2. Quote
const quoteRequest: QuoteRequest = {
  dry: false,                        // true = simulate only, no depositAddress
  swapType: QuoteRequest.swapType.EXACT_INPUT,
  slippageTolerance: 100,            // basis points (100 = 1%)
  originAsset: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
  depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
  destinationAsset: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
  amount: '1000000',                 // smallest units
  refundTo: '0xYourArbitrumAddress',
  refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
  recipient: 'YourSolanaAddress',
  recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
  deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
};
const quote = await OneClickService.getQuote(quoteRequest);

// 3. Build deposit tx to quote.quote.depositAddress, then (optional):
await OneClickService.submitDepositTx({
  depositAddress: quote.quote.depositAddress!,
  txHash: '0xYourTransactionHash',
});

// 4. Poll to terminal state
const status = await OneClickService.getExecutionStatus(quote.quote.depositAddress!);
```

## Go

```go
import (
  "context"
  openapiclient "github.com/defuse-protocol/one-click-sdk-go"
)

configuration := openapiclient.NewConfiguration()
apiClient := openapiclient.NewAPIClient(configuration)
authCtx := context.WithValue(
  context.Background(),
  openapiclient.ContextAccessToken,
  "YOUR_JWT_TOKEN",
)

// GetTokens does not require authentication
tokens, _, err := apiClient.OneClickAPI.GetTokens(context.Background()).Execute()

// Quote — build via NewQuoteRequest, then:
quote, _, err := apiClient.OneClickAPI.GetQuote(authCtx).QuoteRequest(quoteRequest).Execute()

// Status
status, _, err := apiClient.OneClickAPI.GetExecutionStatus(authCtx).
  DepositAddress(*quote.Quote.DepositAddress).Execute()
```

## Rust

```rust
use one_click_sdk_rs::apis::configuration::Configuration;
use one_click_sdk_rs::apis::one_click_api;

// base_path defaults to https://1click.chaindefuser.com
let config = Configuration {
    bearer_access_token: Some("YOUR_JWT_TOKEN".to_string()),
    ..Default::default()
};

let tokens = one_click_api::get_tokens(&config).await?;
let quote = one_click_api::get_quote(&config, quote_request).await?;
let status = one_click_api::get_execution_status(&config, deposit_address).await?;
```

## Method Mapping

| SDK method | HTTP endpoint | Auth |
|------------|---------------|------|
| `getTokens` | `GET /v0/tokens` | none |
| `getQuote` | `POST /v0/quote` | JWT |
| `submitDepositTx` | `POST /v0/deposit/submit` | JWT |
| `getExecutionStatus` | `GET /v0/status` | JWT |

Terminal statuses: `SUCCESS`, `REFUNDED`, `FAILED` (see `api-status.md`). The User Auth / Balance / Order endpoints are available via dedicated services (e.g. `UserAuthService.authenticate`) — see `api-user-auth.md`.

`````

## skills/near-intents/rules/api-tokens.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-tokens.md

`````text
---
title: GET /v0/tokens
impact: CRITICAL
tags: api, tokens
---

Fetch supported tokens. Cache result (changes infrequently).

```typescript
const response = await fetch('https://1click.chaindefuser.com/v0/tokens');
const tokens = await response.json();
```

## Response

```typescript
interface Token {
  assetId: string;          // Use in originAsset/destinationAsset
  decimals: number;         // For amount conversion
  blockchain: string;       // 'eth', 'sol', 'near', 'base', 'arb', 'bsc', etc.
  symbol: string;           // 'USDC', 'ETH', 'wNEAR'
  price: string;            // USD price
  priceUpdatedAt: string;   // ISO timestamp
  contractAddress?: string; // Token contract (for transfers)
}
```

## Helper

```typescript
const findToken = (tokens: Token[], symbol: string, blockchain: string) =>
  tokens.find(t =>
    t.symbol.toLowerCase() === symbol.toLowerCase() &&
    t.blockchain === blockchain
  );

// Example
const usdcEth = findToken(tokens, 'USDC', 'eth');
// usdcEth.assetId = "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near"
// usdcEth.contractAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
```

**Important:** Always use `assetId` from this endpoint. Never construct asset IDs manually.

`````

## skills/near-intents/rules/api-quote.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-quote.md

`````text
---
title: POST /v0/quote
impact: CRITICAL
tags: api, quote, swap
---

# POST /v0/quote

Generates swap quote. Use `dry: true` for preview, `dry: false` to get deposit address.

**Authentication on quotes:** without an API key, an extra **0.25% (25 bps)** fee applies to every non-`ANY_INPUT` quote. With a JWT: **0.20%** (20 bps), or **0.01% (1 bp)** for stablecoin pairs and same-asset multichain routes; with `appFees`, revenue is split 50/50 with 1Click keeping its minimum. Not applicable to `ANY_INPUT` quotes (1Click fees skip them entirely). Source: [Fees](https://docs.near-intents.org/resources/fees.md).

## Request Fields

### Required

| Field | Type | Description |
|-------|------|-------------|
| `dry` | boolean | `true` = preview only (no deposit address generated). `false` = commit quote, returns deposit address valid ~10 minutes |
| `swapType` | string | How to interpret `amount`. See Swap Types below |
| `originAsset` | string | Source token `assetId` from GET /v0/tokens |
| `destinationAsset` | string | Destination token `assetId` from GET /v0/tokens |
| `amount` | string | Amount in smallest unit (wei, lamports, satoshis). Interpreted based on `swapType` |
| `recipient` | string | Address to receive output tokens. Format depends on destination chain |
| `refundTo` | string | Address for refunds if swap fails. Must be valid for origin chain |

### Optional - Routing

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `depositType` | string | `ORIGIN_CHAIN` | Where you'll deposit from. `ORIGIN_CHAIN` = deposit on source blockchain. `INTENTS` = deposit from public intents.near balance. `CONFIDENTIAL_INTENTS` = deposit from a Confidential Intents balance (requires signed-intent execution) |
| `recipientType` | string | `DESTINATION_CHAIN` | Where output goes. `DESTINATION_CHAIN` = send to destination blockchain. `INTENTS` = credit to public intents.near balance. `CONFIDENTIAL_INTENTS` = credit to a Confidential Intents balance |
| `refundType` | string | `ORIGIN_CHAIN` | Where refunds go. `ORIGIN_CHAIN` = refund to source blockchain. `INTENTS` = refund to intents.near balance. `CONFIDENTIAL_INTENTS` = refund to a Confidential Intents balance |
| `depositMode` | string | `SIMPLE` | `SIMPLE` = standard deposit address. `MEMO` = deposit address + memo (required for Stellar) |

### Optional - Pricing

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `slippageTolerance` | number | - | Max acceptable slippage in basis points. 100 = 1%. Affects `minAmountOut` |
| `deadline` | string | ~10min | ISO timestamp. Quote expires after this. User must deposit before deadline |
| `quoteWaitingTimeMs` | number | 3000 | How long to wait for market maker quotes (ms). Use `0` for fastest response |
| `confidentiality` | string | `public` | `public`, `basic`, or `advanced`. Enables a confidential swap on an otherwise normal quote — see [api-confidential-swaps](api-confidential-swaps.md) |

### Optional - Fees & Tracking

| Field | Type | Description |
|-------|------|-------------|
| `referral` | string | Your app identifier (lowercase). Shown in on-chain data and analytics |
| `appFees` | array | Your fee: `[{ recipient: "yourfee.near", fee: 100 }]`. Fee in basis points (100 = 1%) |
| `sessionId` | string | Client session ID for tracking |
| `connectedWallets` | string[] | User's connected wallet addresses (helps with routing) |

### Optional - Virtual Chain (Advanced)

| Field | Type | Description |
|-------|------|-------------|
| `virtualChainRecipient` | string | EVM address for virtual chain recipient |
| `virtualChainRefundRecipient` | string | EVM address for virtual chain refunds |
| `customRecipientMsg` | string | Message for `ft_transfer_call` on NEAR. WARNING: Funds lost if recipient doesn't implement `ft_on_transfer` |

---

## Swap Types

### EXACT_INPUT (most common)

Fixed input amount, variable output.

```typescript
{ swapType: 'EXACT_INPUT', amount: '1000000' } // I want to swap exactly 1 USDC
```

**Behavior:**
- Deposit exactly `amountIn` → receive `amountOut`
- Deposit < `amountIn` → refunded by deadline
- Deposit > `amountIn` → swap processed, excess refunded after completion

### EXACT_OUTPUT

Fixed output amount, variable input.

```typescript
{ swapType: 'EXACT_OUTPUT', amount: '1000000000000000000' } // I want exactly 1 ETH out
```

**Response includes:** `minAmountIn`, `maxAmountIn`

**Behavior:**
- Deposit between `minAmountIn` and `maxAmountIn` → receive exact `amountOut`
- Deposit < `minAmountIn` → refunded
- Deposit > `maxAmountIn` → swap processed, excess refunded

### FLEX_INPUT

Variable input with slippage range. Good for "swap all" scenarios.

```typescript
{ swapType: 'FLEX_INPUT', amount: '1000000', slippageTolerance: 100 }
```

**Response includes:** `minAmountIn`, `minAmountOut`

**Behavior:**
- Any deposit ≥ `minAmountIn` accepted
- Output guaranteed ≥ `minAmountOut`
- Slippage applies to both input and output ranges

### ANY_INPUT

Accumulating deposits. Multiple deposits accepted until deadline.

```typescript
{ swapType: 'ANY_INPUT', amount: '0' } // No fixed amount
```

**Use case:** Aggregate multiple deposits, then withdraw via `/v0/any-input/withdrawals`

---

## Response Fields

```typescript
{
  correlationId: string;      // Unique quote ID
  timestamp: string;          // When quote was generated
  quoteRequest: { ... };      // Echo of your request
  quote: {
    // Deposit info (only when dry: false)
    depositAddress: string;   // Send tokens HERE
    depositMemo: string | null; // Include in tx if non-null (Stellar)

    // Amounts
    amountIn: string;         // Expected input (smallest unit)
    amountInFormatted: string; // Human readable "1.00"
    amountInUsd: string;      // USD value (display only)

    minAmountIn?: string;     // For EXACT_OUTPUT, FLEX_INPUT
    maxAmountIn?: string;     // For EXACT_OUTPUT

    amountOut: string;        // Expected output (smallest unit)
    amountOutFormatted: string; // Human readable
    amountOutUsd: string;     // USD value (DISPLAY ONLY - never use in logic)

    minAmountOut?: string;    // Guaranteed minimum after slippage

    // Timing
    deadline: string;         // ISO timestamp - deposit must arrive before this
    timeWhenInactive: string; // When quote becomes stale (only when dry: false)
    timeEstimate: number;     // Expected completion time in seconds
  }
}
```

---

## Examples

### Basic Swap (ETH USDC → NEAR)

```typescript
// Preview
const preview = await fetch('https://1click.chaindefuser.com/v0/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dry: true,
    swapType: 'EXACT_INPUT',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    destinationAsset: 'nep141:wrap.near',
    amount: '1000000', // 1 USDC (6 decimals)
    recipient: 'user.near',
    refundTo: '0xYourEthAddress',
    slippageTolerance: 100, // 1%
  })
}).then(r => r.json());

// preview.quote.amountOutFormatted = "0.35" (wNEAR)
```

### Commit & Get Deposit Address

```typescript
const committed = await fetch('https://1click.chaindefuser.com/v0/quote', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN' // Authenticated fee schedule (see below)
  },
  body: JSON.stringify({
    dry: false, // Commit!
    swapType: 'EXACT_INPUT',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    destinationAsset: 'nep141:wrap.near',
    amount: '1000000',
    recipient: 'user.near',
    refundTo: '0xYourEthAddress',
    slippageTolerance: 100,
    referral: 'myapp',
    appFees: [{ recipient: 'myfees.near', fee: 50 }], // 0.5% fee
  })
}).then(r => r.json());

// committed.quote.depositAddress = "0x..." → send 1 USDC here
// committed.quote.deadline = "2025-01-16T15:00:00Z" → must deposit before
```

### Stellar (MEMO Required)

```typescript
const stellarQuote = await fetch('https://1click.chaindefuser.com/v0/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dry: false,
    depositMode: 'MEMO', // REQUIRED for Stellar
    swapType: 'EXACT_INPUT',
    originAsset: 'nep141:stellar-native.omft.near',
    destinationAsset: 'nep141:wrap.near',
    amount: '10000000', // 1 XLM (7 decimals)
    recipient: 'user.near',
    refundTo: 'GAXYZ...', // Stellar address
  })
}).then(r => r.json());

// stellarQuote.quote.depositAddress = "GABCD..."
// stellarQuote.quote.depositMemo = "123456" → MUST include in Stellar tx or funds lost
```

### Intents Balance (Deposit to Balance)

```typescript
const toIntents = await fetch('https://1click.chaindefuser.com/v0/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dry: false,
    swapType: 'EXACT_INPUT',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    destinationAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near', // Same!
    depositType: 'ORIGIN_CHAIN',
    recipientType: 'INTENTS', // Credit to intents balance
    recipient: 'user.near', // NEAR account to credit
    refundTo: '0xYourEthAddress',
    amount: '1000000',
  })
}).then(r => r.json());
```

`````

## skills/near-intents/rules/api-status.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-status.md

`````text
---
title: GET /v0/status
impact: CRITICAL
tags: api, status, polling
---

Check swap execution status. Poll until terminal state.

```typescript
const response = await fetch(
  `https://1click.chaindefuser.com/v0/status?depositAddress=${depositAddress}`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);
const status = await response.json();
```

For Stellar (MEMO mode), include memo:
```
?depositAddress=GABCD...&depositMemo=123456
```

## Status Values

| Status | Terminal | Description |
|--------|----------|-------------|
| `PENDING_DEPOSIT` | No | Waiting for deposit to arrive |
| `KNOWN_DEPOSIT_TX` | No | Deposit transaction detected |
| `PROCESSING` | No | Swap being executed |
| `SUCCESS` | Yes | Complete - tokens delivered |
| `INCOMPLETE_DEPOSIT` | Yes | Deposit below required amount |
| `REFUNDED` | Yes | Failed, funds returned to refundTo |
| `FAILED` | Yes | Error occurred |

## Response

```typescript
interface StatusResponse {
  correlationId: string;
  status: string;
  updatedAt: string;
  quoteResponse: QuoteResponse; // Original quote
  swapDetails: {
    amountIn: string;
    amountInFormatted: string;
    amountOut: string;
    amountOutFormatted: string;
    slippage: number;
    originChainTxHashes: Array<{ hash: string; explorerUrl: string }>;
    destinationChainTxHashes: Array<{ hash: string; explorerUrl: string }>;
    refundedAmount?: string;
    refundReason?: string;
    depositedAmount?: string;
  };
}
```

## Polling Pattern

```typescript
async function pollUntilComplete(depositAddress: string, apiKey?: string) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  for (let i = 0; i < 120; i++) { // Max ~4 minutes
    const res = await fetch(
      `https://1click.chaindefuser.com/v0/status?depositAddress=${depositAddress}`,
      { headers }
    );
    const status = await res.json();

    if (['SUCCESS', 'FAILED', 'REFUNDED', 'INCOMPLETE_DEPOSIT'].includes(status.status)) {
      return status;
    }

    await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
  }

  throw new Error('Timeout waiting for swap completion');
}
```

`````

## skills/near-intents/rules/api-deposit-submit.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/api-deposit-submit.md

`````text
---
title: POST /v0/deposit/submit
impact: HIGH
tags: api, deposit
---

Optional endpoint to notify 1Click that you've sent a deposit. Speeds up processing.

```typescript
await fetch('https://1click.chaindefuser.com/v0/deposit/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    txHash: '0x123abc...', // Your deposit transaction hash
    depositAddress: quote.quote.depositAddress,
  })
});
```

## Additional Fields

| Field | When to include |
|-------|-----------------|
| `nearSenderAccount` | NEAR deposits - sender's account ID |
| `memo` | Stellar MEMO mode - the memo used in transaction |

### NEAR Example

```typescript
await fetch('https://1click.chaindefuser.com/v0/deposit/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    txHash: 'Hk3ds...',
    depositAddress: quote.quote.depositAddress,
    nearSenderAccount: 'user.near',
  })
});
```

### Stellar Example

```typescript
await fetch('https://1click.chaindefuser.com/v0/deposit/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    txHash: 'abc123...',
    depositAddress: quote.quote.depositAddress,
    memo: quote.quote.depositMemo,
  })
});
```

Call immediately after your deposit transaction confirms. Not required, but improves UX.

`````

## skills/near-intents/rules/deposit-near.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/deposit-near.md

`````text
---
title: NEAR Deposits
impact: HIGH
tags: deposit, near, nep141
---

## NEP-141 Token

```typescript
import { useWalletSelector } from '@near-wallet-selector/react';

const { selector } = useWalletSelector();
const wallet = await selector.wallet();

const result = await wallet.signAndSendTransactions({
  transactions: [{
    receiverId: tokenContract, // contractAddress from token API
    actions: [{
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer',
        args: { receiver_id: depositAddress, amount: amountIn },
        gas: '50000000000000', // 50 TGas
        deposit: '1', // 1 yoctoNEAR required
      },
    }],
  }],
});

const txHash = result?.[0]?.transaction?.hash;
```

## Native NEAR (wrap first)

Native NEAR must be wrapped to wNEAR before transfer:

```typescript
const { selector } = useWalletSelector();
const wallet = await selector.wallet();

const result = await wallet.signAndSendTransactions({
  transactions: [{
    receiverId: 'wrap.near',
    actions: [
      // 1. Wrap NEAR to wNEAR
      {
        type: 'FunctionCall',
        params: {
          methodName: 'near_deposit',
          args: {},
          gas: '30000000000000',
          deposit: amountIn, // Amount to wrap
        },
      },
      // 2. Transfer wNEAR
      {
        type: 'FunctionCall',
        params: {
          methodName: 'ft_transfer',
          args: { receiver_id: depositAddress, amount: amountIn },
          gas: '50000000000000',
          deposit: '1',
        },
      },
    ],
  }],
});
```

For `/v0/deposit/submit`, include `nearSenderAccount: 'user.near'`.

`````

## skills/near-intents/rules/intents-balance.md

Source: https://raw.githubusercontent.com/near/agent-skills/cb32b6af195e636c1e9c2efe2ea75a6d85b6b67b/skills/near-intents/rules/intents-balance.md

`````text
---
title: Intents Balance Mode
impact: MEDIUM
tags: intents, balance, architecture
---

Alternative architecture where your app operates with intents.near balances instead of chain-to-chain. Choose ONE mode for your app.

## Deposit to Intents Balance

```typescript
const quote = await fetch('https://1click.chaindefuser.com/v0/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dry: false,
    swapType: 'EXACT_INPUT',
    originAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    destinationAsset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near', // Same
    depositType: 'ORIGIN_CHAIN',
    recipientType: 'INTENTS',
    recipient: 'user.near',
    refundTo: '0xUserAddress',
    amount: '1000000',
  })
}).then(r => r.json());
```

## Withdraw from Intents Balance

```typescript
const quote = await fetch('https://1click.chaindefuser.com/v0/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dry: false,
    swapType: 'EXACT_INPUT',
    originAsset: 'nep141:sol-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.omft.near',
    destinationAsset: 'nep141:sol-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.omft.near', // Same
    depositType: 'INTENTS',
    recipientType: 'DESTINATION_CHAIN',
    recipient: 'SolanaAddress...',
    refundTo: 'user.near',
    refundType: 'INTENTS',
    amount: '1000000',
  })
}).then(r => r.json());
```

## Query Balance

```typescript
import { connect, keyStores } from 'near-api-js';

const near = await connect({
  networkId: 'mainnet',
  keyStore: new keyStores.InMemoryKeyStore(),
  nodeUrl: 'https://rpc.mainnet.near.org',
});

const account = await near.account(accountId);
const balance = await account.viewFunction({
  contractId: 'intents.near',
  methodName: 'mt_balance_of',
  args: { account_id: accountId, token_id: tokenId },
});
```

`````
