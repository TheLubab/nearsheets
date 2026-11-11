# NEAR implementation reference

Fetched: 2026-11-11T11:53:19.720Z

Upstream: https://github.com/near/docs

Pinned revision: `7be61a444184e5c11e66363a459f36e6f116f426`

## How to use this file

Use for RPC reads, transaction outcomes, wallet connection, token amounts and SDK selection. SDK and wallet dependencies remain undecided; examples below belong to upstream documentation, not installed project dependencies.

This is a local reference bundle, not application code. Upstream setup commands are reference material only; do not execute them automatically. MDX components and relative links are preserved as source text and may require consulting the linked upstream file. Embedded sources are delimited with long fences so their internal Markdown remains intact.

## Contents

- [api/rpc/introduction.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/introduction.mdx)
- [api/rpc/providers.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/providers.mdx)
- [api/rpc/contracts.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/contracts.mdx)
- [api/rpc/transactions.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/transactions.mdx)
- [api/rpc/gas.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/gas.mdx)
- [tools/near-api.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/tools/near-api.mdx)
- [web3-apps/tutorials/wallet-login.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/web3-apps/tutorials/wallet-login.mdx)
- [integrations/fungible-tokens.mdx](https://github.com/near/docs/blob/7be61a444184e5c11e66363a459f36e6f116f426/integrations/fungible-tokens.mdx)

## api/rpc/introduction.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/introduction.mdx

`````markdown
---
title: "Protocol Call Reference"
icon: file-text
description: "Overview of tools and methods for interacting with the NEAR Protocol."
sidebarTitle: "Introduction"
---

NEAR Protocol provides multiple ways to interact with the network — from low-level JSON-RPC calls to visual explorers and wallets.

## Tools

<CardGroup cols={2}>
  <Card title="NEAR Explorer" icon="search" href="https://nearblocks.io" cta="Open Explorer" arrow>
    Browse transactions, accounts, blocks, and contracts on mainnet and testnet.
  </Card>
  <Card title="NEAR Wallet" icon="wallet" href="https://wallet.near.org" cta="Open Wallet" arrow>
    Create and manage NEAR accounts, send tokens, and interact with dApps.
  </Card>
</CardGroup>

## RPC API

NEAR exposes a JSON-RPC 2.0 API for programmatic access to the network. Send requests with `POST` to the root of a provider endpoint and put the method name in the JSON request body.

<Info>
The endpoint reference in the RPC sidebar is generated from `openapi.json` and is the source of truth for request and response schemas. The hand-written RPC pages provide guidance, context, and worked examples.
</Info>

```bash
curl -X POST https://rpc.mainnet.near.org/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"status","method":"status","params":[]}'
```

See [RPC Providers](/api/rpc/providers) for the full list of public endpoints. Send one JSON-RPC request object per HTTP request. nearcore does not support JSON-RPC batch requests.

## Available Methods

| Category | Methods |
|----------|---------|
| [**Transactions**](/api/rpc/transactions) | `send_tx`, `tx`, `tx_status` (or `EXPERIMENTAL_tx_status` before nearcore 2.14.0), `EXPERIMENTAL_receipt`, `EXPERIMENTAL_receipt_to_tx`, `broadcast_tx_async`, `broadcast_tx_commit` |
| [**Query**](/api/rpc/contracts) | `query` — see [Accounts / Contracts](/api/rpc/contracts) for every supported `request_type` |
| **Accounts & access keys** | `EXPERIMENTAL_view_account`, `changes`, `EXPERIMENTAL_changes`, `EXPERIMENTAL_view_access_key`, `EXPERIMENTAL_view_access_key_list` |
| **Smart contracts** | `EXPERIMENTAL_view_code`, `EXPERIMENTAL_view_state`, `EXPERIMENTAL_call_function` |
| [**Blocks & chunks**](/api/rpc/block-chunk) | `block`, `chunk`, `block_effects`, `EXPERIMENTAL_changes_in_block` |
| **Network** | `status`, `health`, `network_info`, `validators`, `client_config`, `EXPERIMENTAL_validators_ordered` |
| [**Gas & configuration**](/api/rpc/gas) | `gas_price`, `genesis_config`, `EXPERIMENTAL_genesis_config`, `EXPERIMENTAL_protocol_config`, `EXPERIMENTAL_congestion_level` |
| **Light client** | `light_client_proof`, `next_light_client_block`, `EXPERIMENTAL_light_client_proof`, `EXPERIMENTAL_light_client_block_proof` |
| **Maintenance & storage** | `maintenance_windows`, `EXPERIMENTAL_maintenance_windows`, `EXPERIMENTAL_split_storage_info` |

Explore the full interactive reference in the sidebar, or start with [RPC Providers](/api/rpc/providers) to configure your endpoint.

`````

## api/rpc/providers.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/providers.mdx

`````markdown
---
title: "RPC Providers"
icon: file-text
description: "List of public RPC endpoints for the NEAR Protocol."
---

NEAR Protocol exposes a JSON-RPC API for interacting with the network. You can use any of the providers below or run your own node.

## RPC Providers

FastNear maintains a [comprehensive dashboard](https://grafana.fastnear.com/public-dashboards/577b37c6cfe84b2bae23af471d27cade) with response times for most of the available endpoints.

### Mainnet

| Provider | Endpoint | Public Endpoint | Archival Node | Free Tier | Free Tier Limit | Paid Plan |
| --- | --- | :---: | :---: | :---: | :---: | :---: |
| [FASTNEAR](https://fastnear.com) | `https://free.rpc.fastnear.com` | ✅ | Paid Only | ✅ | Not published | ✅ |
| [NEAR](https://near.org) | `https://archival-rpc.mainnet.near.org` | ✅ | ✅ | Severely rate limited | Not published | ❌ |
| [All That Node](https://www.allthatnode.com/protocol/near.dsrv) | N/A | ❌ | ✅ | ✅ | [500K CU/day](https://www.allthatnode.com/pricing.dsrv) | ✅ |
| [Ankr](https://www.ankr.com/rpc/near/) | `https://rpc.ankr.com/near` | ❌ | ❌ | ✅ | [~30 req/s](https://www.ankr.com/docs/rpc-service/service-plans/) | ✅ |
| [BlockPI Network](https://blockpi.io/chain/near) | `https://near.blockpi.network/v1/rpc/{api-key}` | ❌ | ❌ | ✅ | [20 req/s](https://docs.blockpi.io/pricing/pricing-and-rate-limit) | ✅ |
| [dRPC](https://drpc.org/chainlist/near-mainnet-rpc) | `https://near.drpc.org` | ✅ | ❌ | ✅ | [~2,100 CU/s](https://drpc.org/docs/howitworks/ratelimiting) | ✅ |
| [GetBlock](https://getblock.io/nodes/near/) | `https://go.getblock.io/{api-key}` | ❌ | ❌ | ✅ | [50K CU/day](https://docs.getblock.io/getting-started/plans-and-limits/choosing-your-plan) | ✅ |
| [Intear RPC](https://intea.rs/) | `https://rpc.intea.rs` | ✅ | ❌ | ✅ | Not published | ❌ |
| [Lavender.Five Nodes](https://www.lavenderfive.com/tools/near/overview) | N/A | ❌ | ❌ | ✅ | Not published | ✅ |
| [node101](https://node101.io/en/rpc/near) | N/A | ❌ | Paid Only | ❌ | — | ✅ |
| [NodeReal](https://nodereal.io/api-marketplace/near-rpc) | `https://near-mainnet.nodereal.io/v1/{api-key}` | ❌ | ❌ | ✅ | [100M CU/month](https://nodereal.io/api-marketplace/near-rpc) | ✅ |
| [NOWNodes](https://nownodes.io/near) | `https://near.nownodes.io/{api-key}` | ❌ | ❌ | ✅ | [100K req/month](https://nownodes.io/near) | ✅ |
| [QuickNode](https://www.quicknode.com/chains/near) | N/A | ❌ | ✅ | ✅ | [15 req/s](https://www.quicknode.com/pricing) | ✅ |
| [Shitzu](https://shitzuapes.xyz/) | `https://rpc.shitzuapes.xyz` | ✅ | ❌ | ✅ | Not published | ❌ |
| [Tatum](https://tatum.io/chain/near/) | N/A | ❌ | ❌ | ✅ | [3 req/s](https://docs.tatum.io/docs/plans-limits) | ✅ |
| [ZAN](https://zan.top/service/apikeys) | `https://api.zan.top/near-mainnet` | ✅ | ❌ | ✅ | [~20 req/s](https://docs.zan.top/docs/resource-pricing) | ✅ |
| [Zeeve](https://www.zeeve.io/blockchain-protocols/deploy-near-node/) | N/A | ❌ | ✅ | ❌ | — | ✅ |

### Testnet

| Provider | Endpoint | Public Endpoint | Archival Node | Free Tier | Free Tier Limit | Paid Plan |
| --- | --- | :---: | :---: | :---: | :---: | :---: |
| [FASTNEAR](https://fastnear.com) | `https://test.rpc.fastnear.com` | ✅ | Paid Only | ✅ | Not published | ✅ |
| [NEAR](https://near.org) | `https://archival-rpc.testnet.near.org` | ✅ | ✅ | Severely rate limited | Not published | ❌ |
| [All That Node](https://www.allthatnode.com/protocol/near.dsrv) | N/A | ❌ | ✅ | ✅ | [500K CU/day](https://www.allthatnode.com/pricing.dsrv) | ✅ |
| [dRPC](https://drpc.org/chainlist/near-testnet-rpc) | `https://near-testnet.drpc.org` | ✅ | ❌ | ✅ | [~2,100 CU/s](https://drpc.org/docs/howitworks/ratelimiting) | ✅ |
| [Intear RPC](https://intea.rs/) | `https://testnet-rpc.intea.rs` | ✅ | ❌ | ✅ | Not published | ❌ |
| [node101](https://node101.io/en/rpc/near) | N/A | ❌ | Paid Only | ❌ | — | ✅ |
| [QuickNode](https://www.quicknode.com/chains/near) | N/A | ❌ | ✅ | ✅ | [15 req/s](https://www.quicknode.com/pricing) | ✅ |
| [Tatum](https://tatum.io/chain/near/) | N/A | ❌ | ❌ | ✅ | [3 req/s](https://docs.tatum.io/docs/plans-limits) | ✅ |
| [ZAN](https://zan.top/service/apikeys) | `https://api.zan.top/near-testnet` | ✅ | ❌ | ✅ | [~20 req/s](https://docs.zan.top/docs/resource-pricing) | ✅ |
| [Zeeve](https://www.zeeve.io/blockchain-protocols/deploy-near-node/) | N/A | ❌ | ❌ | ❌ | — | ✅ |

<Note>
  **Free Tier Limit** values link to each provider's own pricing/docs page as the source. Limits are reported in the units each provider publishes (`req` = requests, `CU` = compute units), so they are not directly comparable across providers and may change at any time — always confirm on the linked page. "Not published" means the endpoint is free but has no documented numeric limit.
</Note>

For live latency benchmarks across these providers, see [OpenChainBench](https://openchainbench.com/benchmarks/near-rpc) — p50/p90/p99 measured every 60 seconds from US-East, EU-West and Singapore.

## Making requests

Send JSON-RPC 2.0 requests with `POST` to the root of the provider endpoint. Put the method and parameters in the JSON request body.

```bash
curl -X POST https://rpc.mainnet.near.org/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"status","method":"status","params":[]}'
```

Send one request object per HTTP request. nearcore does not support JSON-RPC batch requests. If the body is a JSON array, a nearcore node rejects the whole request with HTTP `400` and error code `-32700` (`Parse error`), and none of the requests in the array run.

<Warning>
  Never load test a shared public endpoint. Run performance tests only against a node you operate or an endpoint whose operator has explicitly authorized the test.
</Warning>

## Run your own node

To run a local RPC node, follow the [NEAR node documentation](https://near-nodes.io/rpc/hardware-rpc).

<Info>
  Testnet tokens have no real value and can be obtained from the [NEAR Faucet](/getting-started/faucet).
</Info>

`````

## api/rpc/contracts.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/contracts.mdx

`````markdown
---
title: Accounts / Contracts
icon: file-text
description: "Learn to query information from accounts and contracts using the NEAR RPC API."
---

The RPC API enables you to view details about accounts and contracts as well as perform contract calls.

## Quick Reference

| Method                                                                             | Purpose                                              |
|------------------------------------------------------------------------------------|------------------------------------------------------|
| [`view_account`](#view-account)                                                    | Get basic account information                        |
| [`view_account_changes`](#view-account-changes)                                    | Monitor account state changes                        |
| [`view_access_key`](#view-access-key)                                              | Get the nonce and permissions of a single access key |
| [`view_access_key_list`](#view-access-key-list)                                    | List all access keys on an account                   |
| [`view_gas_key_nonces`](#view-gas-key-nonces)                                      | List the parallel nonces of a gas key                |
| [`view_code`](#view-contract-code)                                                 | Get deployed contract WASM code                      |
| [`view_global_contract_code`](#view-global-contract-code-by-hash)                  | Get global contract WASM code by its code hash       |
| [`view_global_contract_code_by_account_id`](#view-global-contract-code-by-account) | Get global contract WASM code by its owner account   |
| [`view_state`](#view-contract-state)                                               | Get contract storage data                            |
| [`data_changes`](#view-contract-state-changes)                                     | Monitor contract state changes                       |
| [`contract_code_changes`](#view-contract-code-changes)                             | Monitor contract deployments                         |
| [`call_function`](#call-a-contract-function)                                       | Execute read-only contract methods                   |

---

## View Account

Returns basic account information.

- **method**: `query`
- **params**: `request_type: view_account`, `finality` OR `block_id`, `account_id`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_account",
        "finality": "final",
        "account_id": "account.rpc-examples.testnet"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_account',
      finality: 'final',
      account_id: 'account.rpc-examples.testnet',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_account","finality":"final","account_id":"account.rpc-examples.testnet"}'
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
```json
{
  "jsonrpc": "2.0",
  "result": {
    "amount": "999788200694421800000000",
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904,
    "code_hash": "11111111111111111111111111111111",
    "locked": "0",
    "storage_usage": 410
  },
  "id": "dontcare"
}
```
</Accordion>

<Tip>
**Extra fields on an uninitialized [universal account](/protocol/accounts-contracts/account-id#universal-address)**

A `0u` account that's been funded but [not initialized](/protocol/tutorials/creating-universal-accounts#the-uninitialized-account) returns `state: "uninitialized"` and a `bootstrap_nonce`.

Both fields are omitted once the account initializes — see [Creating Universal Accounts](/protocol/tutorials/creating-universal-accounts#the-uninitialized-account) for a full example response.
</Tip>

---

## View Account Changes

Returns account changes from transactions in a given account.

- **method**: `changes`
- **params**: `changes_type: account_changes`, `account_ids`, `finality` OR `block_id`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "changes",
      "params": {
        "changes_type": "account_changes",
        "account_ids": ["contract.rpc-examples.testnet"],
        "block_id": 187310139
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://archival-rpc.testnet.near.org" });

    const response = await provider.accountChanges(
      ['contract.rpc-examples.testnet'],
      { blockId: 187310139 }
    );
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://archival-rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=changes \
      params:='{"changes_type":"account_changes","account_ids":["contract.rpc-examples.testnet"],"block_id":187310139}'
    ```
  </Tab>
</Tabs>

---

## View Access Key

Returns the nonce and permissions of a single [access key](/protocol/accounts-contracts/access-keys), given the account and the key's public key.

- **method**: `query`
- **params**: `request_type: view_access_key`, `finality` OR `block_id`, `account_id`, `public_key`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_access_key",
        "finality": "final",
        "account_id": "account.rpc-examples.testnet",
        "public_key": "ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_access_key',
      finality: 'final',
      account_id: 'account.rpc-examples.testnet',
      public_key: 'ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_access_key","finality":"final","account_id":"account.rpc-examples.testnet","public_key":"ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa"}'
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
```json
{
  "jsonrpc": "2.0",
  "result": {
    "nonce": 187310139000001,
    "permission": "FullAccess",
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904
  },
  "id": "dontcare"
}
```

For a function-call key, `permission` is an object instead of the `"FullAccess"` string:

```json
"permission": {
  "FunctionCall": {
    "allowance": "250000000000000000000000",
    "receiver_id": "contract.rpc-examples.testnet",
    "method_names": ["get_greeting"]
  }
}
```

For a [gas key](/protocol/accounts-contracts/gas-keys), `permission` also carries the key's prepaid `balance` and number of nonce lanes (`num_nonces`). A full-access gas key uses `GasKeyFullAccess`:

```json
"permission": {
  "GasKeyFullAccess": {
    "balance": "5000000000000000000000000",
    "num_nonces": 8
  }
}
```

A function-call gas key uses `GasKeyFunctionCall`, which is a flat object carrying the same function-call restrictions (`allowance`, `receiver_id`, `method_names`) as `FunctionCall`, alongside the gas-key `balance` and `num_nonces`:

```json
"permission": {
  "GasKeyFunctionCall": {
    "balance": "5000000000000000000000000",
    "num_nonces": 8,
    "allowance": "250000000000000000000000",
    "receiver_id": "contract.rpc-examples.testnet",
    "method_names": ["get_greeting"]
  }
}
```

The nonces of the individual lanes are not included — query them with [`view_gas_key_nonces`](#view-gas-key-nonces).
</Accordion>

<Note>
For a post-quantum [`ml-dsa-65`](/protocol/accounts-contracts/access-keys#signature-schemes) key, pass the **full** `ml-dsa-65:` public key in `public_key`. The network hashes it to locate the on-chain entry, so you query it exactly like an `ed25519` or `secp256k1` key.
</Note>

---

## View Access Key List

Returns the [access keys](/protocol/accounts-contracts/access-keys) of an account, each with its nonce and permissions.

- **method**: `query`
- **params**: `request_type: view_access_key_list`, `finality` OR `block_id`, `account_id`, optional `limit`, optional `after_key`

<Note>
From nearcore 2.14.0, a request without `limit` or `after_key` fails with `TOO_MANY_ACCESS_KEYS` if the account has more than 100 keys (the default limit). Use pagination for such accounts. See [Paginate the key list](#paginate-the-key-list).
</Note>

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_access_key_list",
        "finality": "final",
        "account_id": "account.rpc-examples.testnet"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_access_key_list',
      finality: 'final',
      account_id: 'account.rpc-examples.testnet',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_access_key_list","finality":"final","account_id":"account.rpc-examples.testnet"}'
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
```json
{
  "jsonrpc": "2.0",
  "result": {
    "keys": [
      {
        "public_key": "ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa",
        "access_key": {
          "nonce": 187310139000001,
          "permission": "FullAccess"
        }
      },
      {
        "public_key": "ml-dsa-65-hash:7Xx2X4vHb9dG8pJ5tZqD3mN6kRfWcA1sLuYoP2eB4hT",
        "access_key": {
          "nonce": 187420021000003,
          "permission": "FullAccess"
        }
      }
    ],
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904
  },
  "id": "dontcare"
}
```
</Accordion>

<Note>
Post-quantum [`ml-dsa-65`](/protocol/accounts-contracts/access-keys#signature-schemes) keys are stored on-chain by hash, so they appear here with an `ml-dsa-65-hash:` prefix (a base58-encoded 32-byte SHA3-256 digest) rather than the full `ml-dsa-65:` key. To match an entry to one of your own keys, derive its handle — the SHA3-256 of the domain-separation tag `near:ml-dsa-65-pubkey-hash:v1` followed by the raw public key — and compare it against the returned value (hashing the key without that prefix will not match).
</Note>

### Paginate the key list

<Accordion title="Pagination example">
Request the first page with `limit`:

```json
{
  "jsonrpc": "2.0",
  "id": "dontcare",
  "method": "query",
  "params": {
    "request_type": "view_access_key_list",
    "finality": "final",
    "account_id": "account.rpc-examples.testnet",
    "limit": 1
  }
}
```

The response has `last_key` when more keys remain:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "keys": [
      {
        "public_key": "ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa",
        "access_key": {
          "nonce": 187310139000001,
          "permission": "FullAccess"
        }
      }
    ],
    "last_key": "ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa",
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904
  },
  "id": "dontcare"
}
```

Request the next page with `after_key` set to that `last_key`. To read every page from the same state, also replace `finality` with `block_id` set to the `block_hash` of the first response:

```json
{
  "jsonrpc": "2.0",
  "id": "dontcare",
  "method": "query",
  "params": {
    "request_type": "view_access_key_list",
    "block_id": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "account_id": "account.rpc-examples.testnet",
    "after_key": "ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa",
    "limit": 1
  }
}
```

A response without `last_key` is the last page.
</Accordion>

| Rule | Details |
|------|---------|
| Keys per response | At most `view_access_keys_limit`, which is 100 by default. Node operators can change it. A larger `limit` is lowered to this value. |
| Request without `limit` or `after_key` | Fails with `TOO_MANY_ACCESS_KEYS` if the account has more keys than `view_access_keys_limit`. |
| Version | From nearcore 2.14.0. Nodes on nearcore 2.13 return all keys in one response and ignore `limit` and `after_key`. |

---

## View Gas Key Nonces

Returns the current nonce of every parallel nonce lane of a [gas key](/protocol/accounts-contracts/gas-keys), given the account and the key's public key. The array is indexed by `nonce_index`: the first element is lane `0`, the second is lane `1`, and so on. Use [`view_access_key`](#view-access-key) to see the gas key's balance and permission.

- **method**: `query`
- **params**: `request_type: view_gas_key_nonces`, `finality` OR `block_id`, `account_id`, `public_key`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_gas_key_nonces",
        "finality": "final",
        "account_id": "account.rpc-examples.testnet",
        "public_key": "ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_gas_key_nonces',
      finality: 'final',
      account_id: 'account.rpc-examples.testnet',
      public_key: 'ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_gas_key_nonces","finality":"final","account_id":"account.rpc-examples.testnet","public_key":"ed25519:DCkbTMS8s4kqV4nGvz5kRBdNbY9YwjjvNGNXKpAg2eFa"}'
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
```json
{
  "jsonrpc": "2.0",
  "result": {
    "nonces": [
      187438921000012,
      187438921000003,
      187438921000000,
      187438921000000
    ],
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904
  },
  "id": "dontcare"
}
```

Each lane starts at `block_height * 10^6` from when the key was added and advances independently as transactions use it.
</Accordion>

<Note>
Querying a key that exists but is not a gas key (or does not exist at all) returns an `UnknownGasKey` error.
</Note>

---

## View Contract Code

Returns the contract code (Wasm binary) deployed to the account. The returned code is encoded in base64.

- **method**: `query`
- **params**: `request_type: view_code`, `finality` OR `block_id`, `account_id`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_code",
        "finality": "final",
        "account_id": "contract.rpc-examples.testnet"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_code',
      finality: 'final',
      account_id: 'contract.rpc-examples.testnet',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_code","finality":"final","account_id":"contract.rpc-examples.testnet"}'
    ```
  </Tab>
</Tabs>

---

## View Global Contract Code by Hash

Returns the global contract's Wasm binary for an immutable global contract identified by its code hash. The returned code is base64-encoded.

- **method**: `query`
- **params**: `request_type: view_global_contract_code`, `finality` OR `block_id`, `code_hash`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_global_contract_code",
        "finality": "final",
        "code_hash": "DxfRbrjT3QPmoANMDYTR6iXPGJr7xRUyDnQhcAWjcoFF"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_global_contract_code',
      finality: 'final',
      code_hash: 'DxfRbrjT3QPmoANMDYTR6iXPGJr7xRUyDnQhcAWjcoFF',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_global_contract_code","finality":"final","code_hash":"DxfRbrjT3QPmoANMDYTR6iXPGJr7xRUyDnQhcAWjcoFF"}'
    ```
  </Tab>
</Tabs>

---

## View Global Contract Code by Account

Returns the global contract's Wasm binary for the global contract published under an account ID. The returned code is base64-encoded.

- **method**: `query`
- **params**: `request_type: view_global_contract_code_by_account_id`, `finality` OR `block_id`, `account_id`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_global_contract_code_by_account_id",
        "finality": "final",
        "account_id": "nft-contract.testnet"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_global_contract_code_by_account_id',
      finality: 'final',
      account_id: 'nft-contract.testnet',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_global_contract_code_by_account_id","finality":"final","account_id":"nft-contract.testnet"}'
    ```
  </Tab>
</Tabs>

---

## View Contract State

Returns the state (key-value pairs) of a contract based on a key prefix (base64 encoded). Pass an empty string for `prefix_base64` to return the entire state.

- **method**: `query`
- **params**: `request_type: view_state`, `finality` OR `block_id`, `account_id`, `prefix_base64`, optional `limit`, optional `after_key_base64`, optional `include_proof`

<Warning>
By default, a node rejects a `view_state` request with `TOO_LARGE_CONTRACT_STATE` if the account's state is above 50,000 bytes. A narrower `prefix_base64` does not avoid the error. To read a large state, use pagination. See [Paginate the state](#paginate-the-state).
</Warning>

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "view_state",
        "finality": "final",
        "account_id": "contract.rpc-examples.testnet",
        "prefix_base64": ""
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'view_state',
      finality: 'final',
      account_id: 'contract.rpc-examples.testnet',
      prefix_base64: '',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"view_state","finality":"final","account_id":"contract.rpc-examples.testnet","prefix_base64":""}'
    ```
  </Tab>
</Tabs>

### Paginate the state

<Accordion title="Pagination example">
Request the first page with `limit`:

```json
{
  "jsonrpc": "2.0",
  "id": "dontcare",
  "method": "query",
  "params": {
    "request_type": "view_state",
    "finality": "final",
    "account_id": "contract.rpc-examples.testnet",
    "prefix_base64": "",
    "limit": 2
  }
}
```

The response has `last_key` when more entries remain. Keys and values are base64:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "values": [
      { "key": "YQ==", "value": "MQ==" },
      { "key": "Yg==", "value": "Mg==" }
    ],
    "last_key": "Yg==",
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904
  },
  "id": "dontcare"
}
```

Request the next page with `after_key_base64` set to that `last_key`. To read every page from the same state, also replace `finality` with `block_id` set to the `block_hash` of the first response:

```json
{
  "jsonrpc": "2.0",
  "id": "dontcare",
  "method": "query",
  "params": {
    "request_type": "view_state",
    "block_id": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "account_id": "contract.rpc-examples.testnet",
    "prefix_base64": "",
    "after_key_base64": "Yg==",
    "limit": 2
  }
}
```

A response without `last_key` is the last page.
</Accordion>

A request without `limit` or `after_key_base64` is checked against the size of the whole account. This size is the account's storage usage without the contract code, so a narrower `prefix_base64` does not avoid the error. Paginated requests skip this check.

| Rule | Details |
|------|---------|
| Request without `limit` or `after_key_base64` | Fails with `TOO_LARGE_CONTRACT_STATE` if the account's state is above `trie_viewer_state_size_limit`. The default is 50,000 bytes, and the node operator can change it. |
| Items per page | At most 10,000. A larger `limit` is lowered to 10,000. |
| Bytes per page | The node stops adding items once the keys and values of the page reach 50,000 bytes. The last item can make a page larger than that. |
| `after_key_base64` | After decoding, the key must start with the decoded `prefix_base64`. The base64 strings themselves do not have to match. Otherwise the node returns `INTERNAL_ERROR`. |
| `include_proof` | Cannot be combined with `limit` or `after_key_base64`. If it is, the node returns `INTERNAL_ERROR`. |
| Version | `limit` and `after_key_base64` are available from nearcore 2.13.0. |

---

## View Contract State Changes

Returns state change details of a contract based on a key prefix (base64 encoded).

- **method**: `changes`
- **params**: `changes_type: data_changes`, `account_ids`, `key_prefix_base64`, `finality` OR `block_id`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "changes",
      "params": {
        "changes_type": "data_changes",
        "account_ids": ["contract.rpc-examples.testnet"],
        "key_prefix_base64": "",
        "block_id": 187310139
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://archival-rpc.testnet.near.org" });

    const response = await provider.contractStateChanges(
      ['contract.rpc-examples.testnet'],
      { blockId: 187310139 },
      ''
    );
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://archival-rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=changes \
      params:='{"changes_type":"data_changes","account_ids":["contract.rpc-examples.testnet"],"key_prefix_base64":"","block_id":187310139}'
    ```
  </Tab>
</Tabs>

---

## View Contract Code Changes

Returns code changes made when deploying a contract. Change is returned as a base64 encoded WASM file.

- **method**: `changes`
- **params**: `changes_type: contract_code_changes`, `account_ids`, `finality` OR `block_id`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "changes",
      "params": {
        "changes_type": "contract_code_changes",
        "account_ids": ["contract.rpc-examples.testnet"],
        "block_id": 187309439
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://archival-rpc.testnet.near.org" });

    const response = await provider.contractCodeChanges(
      ['contract.rpc-examples.testnet'],
      { blockId: 187309439 }
    );
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://archival-rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=changes \
      params:='{"changes_type":"contract_code_changes","account_ids":["contract.rpc-examples.testnet"],"block_id":187309439}'
    ```
  </Tab>
</Tabs>

---

## Call a Contract Function

Allows you to call a contract method as a view function (read-only).

- **method**: `query`
- **params**: `request_type: call_function`, `finality` OR `block_id`, `account_id`, `method_name`, `args_base64`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "query",
      "params": {
        "request_type": "call_function",
        "finality": "final",
        "account_id": "contract.rpc-examples.testnet",
        "method_name": "get_greeting",
        "args_base64": ""
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.query({
      request_type: 'call_function',
      finality: 'final',
      account_id: 'contract.rpc-examples.testnet',
      method_name: 'get_greeting',
      args_base64: '',
    });
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=query \
      params:='{"request_type":"call_function","finality":"final","account_id":"contract.rpc-examples.testnet","method_name":"get_greeting","args_base64":""}'
    ```
  </Tab>
</Tabs>

### Decode the result

A `call_function` query returns the contract's serialized return value as an array of bytes. Decode those bytes as UTF-8 and parse as JSON.

For example, `[34, 104, 101, 108, 108, 111, 34]` decodes to the JSON string `"hello"`.

```js
// Decoding a call_function result
JSON.parse(Buffer.from(response.result.result).toString("utf8"));
```


#### Transaction return values

Transaction and receipt outcomes encode successful return values in the base64 string `status.SuccessValue`. Decode that string, then parse it if the method returns JSON. An empty `SuccessValue` indicates no return value. Inspect `Failure` as an execution error.

With a full transaction RPC response saved as `response.json`:

```bash
node -e '
const response = JSON.parse(require("node:fs").readFileSync("response.json", "utf8"));
const status = response.result.status;
if ("SuccessValue" in status) {
  console.log(status.SuccessValue === "" ? undefined :
    JSON.parse(Buffer.from(status.SuccessValue, "base64").toString("utf8")));
} else {
  console.log(status);
}
'
```

---

## Error Handling

Query errors come back in four ways. Check for an `error` object first, and then for `result.error`.

### Request errors

If the node cannot parse the request parameters, it returns an error with `error.name` set to `REQUEST_VALIDATION_ERROR` and `error.cause.name` set to `PARSE_ERROR`. This happens, for example, when `args_base64` is not valid base64.

### Internal errors

If the node fails internally, it returns an error with `error.name` set to `INTERNAL_ERROR`. The message is in `error.cause.info.error_message`. `view_state` also answers this way when `include_proof` is combined with pagination, or when `after_key_base64` is outside the prefix.

### Handler errors

For the errors below, the response has `error.name` set to `HANDLER_ERROR` and `error.cause.name` set to the listed value. For example:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "name": "HANDLER_ERROR",
    "cause": {
      "name": "TOO_LARGE_CONTRACT_STATE",
      "info": {
        "contract_account_id": "contract.rpc-examples.testnet",
        "block_height": 187440904,
        "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW"
      }
    },
    "code": -32000,
    "message": "Server error",
    "data": "State of contract contract.rpc-examples.testnet is too large to be viewed"
  },
  "id": "dontcare"
}
```

| `error.cause.name`         | Description                                     | Solution                                                |
|----------------------------|-------------------------------------------------|---------------------------------------------------------|
| `UNKNOWN_ACCOUNT`          | Account does not exist                          | Check account ID spelling                               |
| `INVALID_ACCOUNT`          | Invalid account format                          | Use valid account ID (e.g., `account.near`)             |
| `UNKNOWN_BLOCK`            | Block not found                                 | Use a valid block hash or height                        |
| `UNKNOWN_GAS_KEY`          | Key is not a gas key or does not exist          | Check the public key and that it was added as a gas key |
| `GARBAGE_COLLECTED_BLOCK`  | Block too old                                   | Use archival node or more recent block                  |
| `NO_CONTRACT_CODE`         | No contract deployed (returned by `view_code`)  | Verify the account has a deployed contract              |
| `NO_GLOBAL_CONTRACT_CODE`  | No global contract for this code hash or account | Check the code hash or the publishing account ID       |
| `TOO_LARGE_CONTRACT_STATE` | Account state is above the node's `view_state` limit | Paginate with `limit` and `after_key_base64`       |
| `TOO_MANY_ACCESS_KEYS`     | Account has more keys than one response can hold | Paginate with `limit` and `after_key`                  |

### Errors in the result

A view function call that fails while the contract runs does not return an `error` object. The node answers with HTTP status 200, and `result.error` holds a text message:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "block_hash": "56xEo2LorUFVNbkFhCncFSWNiobdp1kzm14nZ47b5JVW",
    "block_height": 187440904,
    "error": "wasm execution failed with error: MethodResolveError(MethodNotFound)",
    "logs": []
  },
  "id": "dontcare"
}
```

Check `result.error` before you decode `result.result`. `view_access_key` for a key that does not exist answers the same way.

Common messages:

- The method does not exist: `wasm execution failed with error: MethodResolveError(MethodNotFound)`.
- The account has no contract: the message starts with `wasm execution failed with error: CompilationError(CodeDoesNotExist`.

`````

## api/rpc/transactions.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/transactions.mdx

`````markdown
---
title: "Transactions"
description: "Send transactions and query their status using the NEAR RPC API."
icon: file-text
sidebarTitle: "Transactions"
---

The RPC API exposes several methods for broadcasting signed transactions and tracking their execution. All transaction methods accept a base64-encoded `signed_tx_base64` payload. Status methods accept either the same payload or a `tx_hash` + `sender_account_id` pair.

## Quick Reference

| Method | Purpose |
|--------|---------|
| [`send_tx`](#send-transaction) | Broadcast a signed transaction and wait for the result |
| [`tx`](#transaction-status) | Get the status of a previously broadcast transaction |
| [`tx_status`](#transaction-status-with-receipts) | Like `tx`, but also returns receipt details (nearcore 2.14.0 or later) |
| [`EXPERIMENTAL_receipt`](#receipt-by-id) | Fetch a single receipt by id |
| [`broadcast_tx_async`](#broadcast-async) | Broadcast and return immediately with the transaction hash |
| [`broadcast_tx_commit`](#broadcast-commit) | Broadcast and wait until the transaction is included in a block |

<Info>
Prefer `send_tx` and `tx` for new integrations, and `tx_status` on nodes that run nearcore 2.14.0 or later. On older nodes, use `EXPERIMENTAL_tx_status`, which also works on 2.14.0 and later. The `broadcast_tx_async` and `broadcast_tx_commit` methods are kept for backward compatibility but offer less control over when the call returns.
</Info>

---

## The `wait_until` Field

`send_tx`, `tx`, and `tx_status` accept an optional `wait_until` field that controls **how long the RPC waits before returning a response**. Each value waits for a stricter execution milestone than the previous one — pick the lowest level that satisfies your use case so you don't pay extra latency.

| Value | Returns when… | Typical use |
|-------|---------------|-------------|
| `NONE` | Right away. `send_tx` returns before the node validates or includes the transaction, and its response is `{"final_execution_status": "NONE"}` with no transaction hash. `tx` and `tx_status` return the current status without waiting. | Fire-and-forget broadcasts. Compute the transaction hash on the client, or use `broadcast_tx_async` if you need the RPC to return it. |
| `INCLUDED` | The transaction is included in a block (the block may not be finalized). | UI optimism: you want to confirm the tx hit the chain. |
| `EXECUTED_OPTIMISTIC` *(default)* | Included + all non-refund receipts have executed (blocks may still not be finalized). | Default for most apps — you can read the result. |
| `INCLUDED_FINAL` | Included in a *finalized* block. | You need finality but don't care about receipts. |
| `EXECUTED` | Finalized + all non-refund receipts executed. | Strong correctness without waiting for refund receipts. |
| `FINAL` | Finalized + all receipts (including refunds) finalized. | Accounting and cross-chain settlement, where refund-tracking matters. |

If the field is omitted, the RPC behaves as if `EXECUTED_OPTIMISTIC` was passed.

```json
{
  "jsonrpc": "2.0",
  "id": "dontcare",
  "method": "send_tx",
  "params": {
    "signed_tx_base64": "DwAAAHNlbmRlci50ZXN0bmV0...",
    "wait_until": "FINAL"
  }
}
```

<Warning>
Higher `wait_until` levels can take several seconds. If your client has a short timeout, prefer `INCLUDED` or `EXECUTED_OPTIMISTIC` and poll `tx` for the stricter level.
</Warning>

---

## Send Transaction

Broadcasts a signed transaction and waits for the requested execution milestone before returning.

- **method**: `send_tx`
- **params**: `signed_tx_base64`, optional `wait_until`

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "send_tx",
      "params": {
        "signed_tx_base64": "DwAAAHNlbmRlci50ZXN0bmV0...",
        "wait_until": "EXECUTED_OPTIMISTIC"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.sendTransactionUntil(
      signedTransaction,
      'EXECUTED_OPTIMISTIC',
    );
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 id=dontcare method=send_tx \
      params:='{"signed_tx_base64":"DwAAAHNlbmRlci50ZXN0bmV0...","wait_until":"EXECUTED_OPTIMISTIC"}'
    ```
  </Tab>
</Tabs>

Successful contract return values appear as base64-encoded `status.SuccessValue`. See the [decoded result](/api/rpc/contracts#transaction-return-values) reference to read them.

---

## Transaction Status

Returns the status of a previously submitted transaction.

- **method**: `tx`
- **params**: either `signed_tx_base64`, or `tx_hash` + `sender_account_id`. Optional `wait_until`.

<Tabs>
  <Tab title="JSON (by hash)">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "tx",
      "params": {
        "tx_hash": "6zgh2u9DqHHiXzdy9ouTP7oGky2T4nugbhqsK7wQHnZS",
        "sender_account_id": "sender.testnet",
        "wait_until": "FINAL"
      }
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

    const response = await provider.txStatus(
      '6zgh2u9DqHHiXzdy9ouTP7oGky2T4nugbhqsK7wQHnZS',
      'sender.testnet',
      'FINAL',
    );
    ```
  </Tab>
</Tabs>

---

## Transaction Status with Receipts

`tx_status` returns the same payload as `tx`, plus a `receipts` list with the receipts that the transaction produced. It is useful when debugging cross-contract calls.

- **method**: `tx_status`
- **params**: same as `tx`

The `receipts` list can be incomplete:

- Receipts that have not run yet when the node answers are not in the list. With the default `wait_until` (`EXECUTED_OPTIMISTIC`), refund receipts are often still missing. `wait_until: "FINAL"` waits until all receipts, including refunds, have run.
- When the signer and the receiver are the same account, the list leaves out the first receipt. This is the receipt converted from the transaction.
- A node that does not track the signer's shard can return the result without the `receipts` list.

<Note>
`tx_status` is available from nearcore 2.14.0. The 2.14.0 release candidates (versions that start with `2.14.0-rc`) also have it. Earlier versions call this method `EXPERIMENTAL_tx_status`. Nodes that run them return a "Method not found" error for `tx_status`. `EXPERIMENTAL_tx_status` still works in 2.14.0, as a deprecated alias with identical request and response types. Use `EXPERIMENTAL_tx_status` until every node you call runs one of these versions or later. To see which version a node runs, call the `status` method and read `version.version`.
</Note>

---

## Receipt by Id

Fetches a single receipt by its id.

- **method**: `EXPERIMENTAL_receipt`
- **params**: `receipt_id`

---

## Broadcast Async

Broadcasts a signed transaction and returns immediately with the transaction hash. It submits the transaction the same way as `send_tx` with `wait_until: "NONE"`. The difference is the response: `broadcast_tx_async` returns the transaction hash as a string, while `send_tx` returns only `{"final_execution_status": "NONE"}`.

- **method**: `broadcast_tx_async`
- **params**: a single positional string — the base64-encoded signed transaction.

---

## Broadcast Commit

Broadcasts a signed transaction and waits for it to be included in a block. Equivalent to `send_tx` with `wait_until: "EXECUTED_OPTIMISTIC"`.

- **method**: `broadcast_tx_commit`
- **params**: a single positional string — the base64-encoded signed transaction.

---

## Error Handling

`INTERNAL_ERROR` is returned as the error `name`. The other errors are returned with `name` set to `HANDLER_ERROR` and the error code below in `cause.name`.

| Error Code | Description | Solution |
|------------|-------------|----------|
| `INVALID_TRANSACTION` | The signed transaction failed validation. | See [Invalid transactions](#invalid-transactions). |
| `TIMEOUT_ERROR` | The chosen `wait_until` level was not reached before the RPC's deadline. | See [Timeouts](#timeouts). |
| `UNKNOWN_TRANSACTION` | No record of the requested transaction hash. `tx` and `tx_status` return this only when `wait_until` is `NONE`. With other values, they wait until the deadline and return `TIMEOUT_ERROR`. | Verify the hash and `sender_account_id`. |
| `DOES_NOT_TRACK_SHARD` | The node does not track the shard needed to answer the request. | Send the request to a node that tracks that shard, such as an RPC node that tracks all shards. |
| `INTERNAL_ERROR` | The node reached its limits or failed internally. | Try again later. |

### Invalid transactions

The reason for an `INVALID_TRANSACTION` error is in `data.TxExecutionError.InvalidTxError`. For example, this is the error for a transaction whose reference block hash is too old:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "name": "HANDLER_ERROR",
    "cause": {
      "name": "INVALID_TRANSACTION",
      "info": {}
    },
    "code": -32000,
    "message": "Server error",
    "data": {
      "TxExecutionError": {
        "InvalidTxError": "Expired"
      }
    }
  },
  "id": "dontcare"
}
```

The reason is a string, such as `"Expired"`, or an object, such as `{"InvalidNonce": {"tx_nonce": 5, "ak_nonce": 7}}`. What to do depends on the reason:

- `Expired`: the reference block hash is too old. Refresh `block_hash` and sign again.
- `InvalidSignature`: the signature does not match the signer's key. Sign again with the matching access key.
- `ShardCongested` or `ShardStuck`: the receiver's shard is congested. The node checks congestion before the signature, key, nonce and balance, so the transaction may still be valid. Wait, and then send the same signed transaction again while its block hash is still valid.
- Any other reason: fix the reported nonce, key or balance, and sign again.

### Timeouts

A `TIMEOUT_ERROR` means that the transaction did not reach the chosen `wait_until` level before the RPC's deadline. The nearcore default deadline is 10 seconds. Node operators can change it, so some providers wait longer.

From nearcore 2.14.0, `cause.info.cause` says how far the transaction got. Older nodes send no `cause.info`.

- `NOT_OBSERVED`: the node has not seen the transaction in a block. After `send_tx`, poll `tx` with the transaction hash, and send the same signed transaction again if it does not appear. After `tx`, check the hash and `sender_account_id`.
- `PENDING`: the node has seen the transaction, but it has not reached the chosen level yet. The last known status is in `cause.info.status`. Poll `tx` again.
- `DOES_NOT_TRACK_SHARD`: the node does not track the shard of the transaction, and it got no answer from a node that does. Send the request to a node that tracks that shard.
- `ERROR`: the node could not get a usable status before the deadline. Try again later.

You can also lower `wait_until` and poll `tx`, or use an archival or dedicated provider.

`````

## api/rpc/gas.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/api/rpc/gas.mdx

`````markdown
---
title: Gas
icon: file-text
description: "Query gas prices for specific blocks or hashes using the NEAR RPC API."
---

The RPC API enables you to query the gas price for a specific block or hash.

## Quick Reference

| Parameter | Type | Description |
| --- | --- | --- |
| `block_height` | `number` | Specific block height to query gas price for |
| `block_hash` | `string` | Specific block hash to query gas price for |
| `null` | `null` | Returns gas price for the latest block |

---

## Gas Price

Returns gas price for a specific `block_height` or `block_hash`. Using `[null]` will return the most recent block's gas price.

- **method**: `gas_price`
- **params**: `[block_height]`, `["block_hash"]`, or `[null]`

<Tabs>
  <Tab title="null (latest)">

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "gas_price",
      "params": [null]
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({
        url: "https://test.rpc.fastnear.com",
    });

    const response = await provider.gasPrice(null);
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://rpc.testnet.near.org \
      jsonrpc=2.0 \
      id=dontcare \
      method=gas_price \
      params:='[null]'
    ```
  </Tab>
</Tabs>

  </Tab>
  <Tab title="by block height">

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "gas_price",
      "params": [187310138]
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({
        url: "https://archival-rpc.testnet.near.org",
    });

    const response = await provider.gasPrice(187310138);
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://archival-rpc.testnet.near.org \
      jsonrpc=2.0 \
      id=dontcare \
      method=gas_price \
      params:='[187310138]'
    ```
  </Tab>
</Tabs>

  </Tab>
  <Tab title="by block hash">

<Tabs>
  <Tab title="JSON">
    ```json
    {
      "jsonrpc": "2.0",
      "id": "dontcare",
      "method": "gas_price",
      "params": ["6RWmTYhXCzjMjoY3Mz1rfFcnBm8E6XeDDbFEPUA4sv1w"]
    }
    ```
  </Tab>
  <Tab title="JavaScript">
    ```js
    import { JsonRpcProvider } from "near-api-js";

    const provider = new JsonRpcProvider({
        url: "https://archival-rpc.testnet.near.org",
    });

    const response = await provider.gasPrice(
      '6RWmTYhXCzjMjoY3Mz1rfFcnBm8E6XeDDbFEPUA4sv1w',
    );
    ```
  </Tab>
  <Tab title="HTTPie">
    ```bash
    http POST https://archival-rpc.testnet.near.org \
      jsonrpc=2.0 \
      id=dontcare \
      method=gas_price \
      params:='["6RWmTYhXCzjMjoY3Mz1rfFcnBm8E6XeDDbFEPUA4sv1w"]'
    ```
  </Tab>
</Tabs>

  </Tab>
</Tabs>

<Accordion title="Example response">
```json
{
  "jsonrpc": "2.0",
  "id": "dontcare",
  "result": {
    "gas_price": "100000000"
  }
}
```
</Accordion>

`````

## tools/near-api.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/tools/near-api.mdx

`````markdown
---
title: API Libraries
icon: code
description: "Learn to use APIs in JavaScript, Rust, and Python to interact with the blockchain."
---

We offer a collection of language-specific libraries that allow developers to interact with the NEAR blockchain from both frontend and backend applications. The different APIs allow you to perform a variety of actions on the NEAR blockchain, including but not limited to:

1. Create and manage NEAR accounts
2. Call functions on smart contracts
3. Transfer tokens, including native NEAR, Fungible Tokens, Non-Fungible Tokens
4. Sign transactions/meta-transactions/messages and broadcasting them to the network
5. Deploy smart contracts

---

## Available APIs

We have APIs available for Javascript, Rust, and Python. Add them to your project using the following commands:

<Tabs>
  <Tab title="🌐 near-api-js">

  ```bash
  npm i near-api-js
  ```

  </Tab>
  <Tab title="🌐 near-kit">

  ```bash
  npm i near-kit
  ```

  </Tab>
  <Tab title="🦀 near-api-rs">

  ```bash
  cargo add near-api
  ```

  </Tab>
  <Tab title="🦀 near-kit-rs">

```bash
cargo add near-kit --features mnemonic,file-signer,keyring
```

  </Tab>
  <Tab title="🐍 near-kit-py">

```bash
pip install near-kit python-dotenv
```

The Python package is named `near-kit` and is imported as `near`.

  </Tab>
</Tabs>

<Tip>
If you are building a web app and need to add Wallet Login on it you will instead need a [Wallet Connector](/web3-apps/tutorials/wallet-login).
</Tip>

---

Use **Node.js 22.22.2 or newer** for the JavaScript examples. The [complete examples](https://github.com/near-examples/near-api-examples) include dependency lockfiles and typechecks for each JavaScript library. The repository also includes `near-api-rs`, `near-kit-rs`, and `near-kit-py` examples with dependency lockfiles. The Rust examples use Rust 1.96 and the Python examples require Python 3.11 or newer.

Signing examples load their account ID and key from a shared `.env` file, as described in the repository's setup instructions. Run each example from its package directory. Excerpts below focus on individual operations; the linked source files include the surrounding client and signer setup.

<Accordion title="The JavaScript near-kit private-key helper">

The JavaScript near-kit examples import `privateKeyFromString` from a shared helper. Include this file when copying an example: it parses serialized key material before passing it to the client and rejects missing or malformed keys.

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/helpers/private-key.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```javascript title="private-key.js" lines
import { parseKey } from "near-kit";

/**
 * Parse and validate serialized key material before passing it to the client.
 * @param {string | undefined} value
 * @returns {import("near-kit").PrivateKey}
 */
export function privateKeyFromString(value) {
  if (!value) throw new Error("A private key is required for this example");
  // near-kit returns a plain string here, even though parseKey validated it.
  return /** @type {import("near-kit").PrivateKey} */ (parseKey(value).secretKey);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/helpers/private-key.js)

</div>

{/* /github-code */}

</Accordion>

## Account

### Get Balance

Queries an account balance. The examples below show the fields and amount types returned by each library.

<Tabs>
  <Tab title="🌐 near-api-js">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/tokens-balance.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="tokens-balance.ts" lines
import { Account, JsonRpcProvider } from "near-api-js";
import { NEAR, FungibleToken } from "near-api-js/tokens";
import { USDT } from "near-api-js/tokens/testnet";

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const accountId: string = 'influencer.testnet';
const account = new Account(accountId, provider);

// ------- Fetch NEAR tokens balance -------
const nearTokensBalanceInt: bigint = await account.getBalance(NEAR);
console.log("NEAR: ", NEAR.toDecimal(nearTokensBalanceInt, 2));

// ------- Fetch USDT tokens balance -------
const usdtTokensBalanceInt: bigint = await account.getBalance(USDT);
console.log("USDT: ", USDT.toDecimal(usdtTokensBalanceInt, 2));

// ------- Fetch REF tokens balance in the smallest units as BigInt -------
const REF = new FungibleToken("ref.fakes.testnet", {
  decimals: 18,
  symbol: "REF",
  name: "REF Token",
});

const refTokensBalanceInt: bigint = await account.getBalance(REF);
console.log("REF: ", REF.toDecimal(refTokensBalanceInt, 2));
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/tokens-balance.ts)

</div>

{/* /github-code */}
  </Tab>
  <Tab title="🌐 near-kit">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/tokens-balance.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="tokens-balance.js" lines
import { Near } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });

// Create a connection to testnet (no signing needed for view operations)
const near = new Near({ network: "testnet" });

// Get the account ID from environment or use a default
const accountId = process.env.ACCOUNT_ID || "example-account.testnet";

// Get NEAR balance for the account
const balance = await near.getBalance(accountId);

console.log(`Account: ${accountId}`);
console.log(`NEAR Balance: ${balance} NEAR`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/tokens-balance.js)

</div>

{/* /github-code */}
  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/account_details.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
fname: account_details.rs
language: rust
*/}

```rust title="account_details.rs" lines
use near_api::{Account, AccountId, NetworkConfig, Tokens};

#[tokio::main]
async fn main() {
    let my_account_id: AccountId = "example-account.testnet".parse().unwrap();
    // Create an account object
    let my_account = Account(my_account_id.clone());

    // Create a connection to the NEAR testnet
    let network = NetworkConfig::testnet();

    // Gets the available, and staked balance in yoctoNEAR
    let near_balance = Tokens::account(my_account_id.clone())
        .near_balance()
        .fetch_from(&network)
        .await
        .unwrap();
    println!("{:?}", near_balance);

    // Account's state, including its code hash and storage usage
    let account_info = my_account.view().fetch_from(&network).await.unwrap();
    println!("{:?}", account_info);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/account_details.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/account_details.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 5
end: 15
*/}

```rust title="account_details.rs" lines
// Create a connection to testnet (no signing needed for view operations)
let near = Near::testnet().build();
let account_id = "example-account.testnet";

// Get the account balance
let balance = near.balance(account_id).await?;
println!("Account: {account_id}");
println!(
    "Available: {}, staked: {}",
    balance.available, balance.locked
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/account_details.rs#L5-L15)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

The one-shot Python helpers default to mainnet. Select testnet explicitly:

```python
import near

account_id = "example-account.testnet"
balance = near.balance(account_id, network="testnet")
print(f"Balance: {balance}")
```

  </Tab>
</Tabs>

### Get State

Get basic account information, such as its code hash and storage usage.

<Tip>
If you are using this call to validate a recipient before sending tokens from a frontend, see [Validating Recipient Accounts](../web3-apps/tutorials/account-validation) for the full strategy.
</Tip>

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/account-details.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="account-details.ts" lines
import { Account, JsonRpcProvider } from "near-api-js";

// Option 1: Gather details through the RPC Provider
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

const rpcState = await provider.viewAccount({accountId: "example-account.testnet"});
console.log(rpcState);

// Option 2: Use an Account object
const account = new Account("example-account.testnet", provider);
const accountState = await account.getState();

console.log(accountState);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/account-details.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

```javascript title="near-kit account state"
import { Near } from "near-kit";

// Create a connection to testnet
const near = new Near({ network: "testnet" });

// Get account state using the Near instance
const accountId = "example-account.testnet";
const account = await near.getAccount(accountId);

console.log(account);
```

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/account_details.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 21
end: 21
fname: account_details.rs
language: rust
*/}

```rust title="account_details.rs" lines
let account_info = my_account.view().fetch_from(&network).await.unwrap();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/account_details.rs#L21-L21)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/account_details.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 17
end: 20
*/}

```rust title="account_details.rs" lines
// Get the account state: code hash and storage usage
let account = near.account(account_id).await?;
println!("Code hash: {}", account.code_hash);
println!("Storage usage: {} bytes", account.storage_usage);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/account_details.rs#L17-L20)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

The one-shot Python helpers default to mainnet. Select testnet explicitly:

```python
import near

account_id = "example-account.testnet"
account = near.account(account_id, network="testnet")
print(f"Code hash: {account.code_hash}")
print(f"Storage usage: {account.storage_usage} bytes")
```

  </Tab>
</Tabs>

### Create Named Account

To create a named account like `user.testnet`, you need to call the `create_account` function on `near` (or `testnet`), passing as parameters the new account ID, and a public key to add as [FullAccess key](/protocol/accounts-contracts/access-keys#full-access-keys).

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/create-tla.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: typescript
*/}

```typescript title="create-tla.ts" lines
import dotenv from "dotenv";
import { Account, JsonRpcProvider, KeyPair, KeyPairString, nearToYocto } from "near-api-js";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const account = new Account(accountId, provider, privateKey); // example-account.testnet

// Generate a new accountId and key
const newAccountId: string = Date.now() + ".testnet";
const keyPair = KeyPair.fromRandom("ed25519");
const publicKey: string = keyPair.getPublicKey().toString();

await account.createAccount({
  newAccountId,
  publicKey,
  nearToTransfer: nearToYocto("0")
});

console.log(`Created ${newAccountId} with private key ${keyPair.toString()}`);

// Option 2: Call `testnet` directly
const newAccountId2: string = Date.now() + ".testnet";

await account.callFunction({
  contractId: "testnet",
  methodName: "create_account",
  args: {
    "new_account_id": newAccountId2,
    "new_public_key": publicKey
  }
});

console.log(`Created account ${newAccountId2} with privateKey: ${keyPair.toString()}`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/create-tla.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/create-tla.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="create-tla.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near, generateKey } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Generate a new key pair for the top-level account
const keyPair = generateKey();
const publicKey = keyPair.publicKey.toString();

// Create a unique top-level account name using timestamp
const newAccountId = `${Date.now()}.testnet`;

// Create the top-level account by calling the testnet contract
await near.call("testnet", "create_account", {
  new_account_id: newAccountId,
  new_public_key: publicKey,
});

console.log(`Created top-level account: ${newAccountId}`);
console.log(`Private key: ${keyPair.secretKey}`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/create-tla.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/create_account.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 32
end: 47
fname: create_account.rs
language: rust
*/}

```rust title="create_account.rs" lines
let private_key = signer::generate_secret_key().unwrap();
let create_account_result = Account::create_account(new_account_id.clone()) // example-account.testnet
    .fund_myself(
        account_id.clone(),
        NearToken::from_millinear(100), // Initial balance for new account in yoctoNEAR
    )
    .with_public_key(private_key.public_key())
    .with_signer(signer.clone()) // Signer is the account that is creating the new account
    .send_to(&network)
    .await
    .unwrap();

println!("Private key: {:?}", private_key.to_string());
println!("Public key: {:?}", private_key.public_key().to_string());
println!("{:?}", create_account_result);

```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/create_account.rs#L32-L47)

</div>

{/* /github-code */}

  <Accordion title="Creating an account from a seed phrase">

  You can also create an account via a randomly generated seed phrase.

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/create_account_from_seed.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 32
end: 46
fname: create_account_from_seed.rs
language: rust
*/}

```rust title="create_account_from_seed.rs" lines
    let (seed_phrase, seed_pk) = signer::generate_seed_phrase().unwrap();
    let create_account_result = Account::create_account(new_account_id.clone()) // example-account.testnet
        .fund_myself(
            account_id.clone(),
            NearToken::from_millinear(100), // Initial balance for new account in yoctoNEAR
        )
        .with_public_key(seed_pk)
        .with_signer(signer.clone()) // Signer is the account that is creating the new account
        .send_to(&network)
        .await
        .unwrap();

    println!("Seed phrase: {:?}", seed_phrase);
    println!("{:?}", create_account_result);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/create_account_from_seed.rs#L32-L46)

</div>

{/* /github-code */}

  </Accordion>

  </Tab>
  <Tab title="🦀 near-kit-rs">

  <Tabs>
  <Tab title="random key">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/create_tla.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="create_tla.rs" lines
use near_kit::signer::SecretKey;
use near_kit::{Error, Gas, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Generate a new key pair for the top-level account
    let key = SecretKey::generate_ed25519();

    // Create a unique top-level account name using the timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let new_account_id = format!("{timestamp}.testnet");

    // Create the top-level account by calling the testnet contract
    near.call("testnet", "create_account")
        .args(serde_json::json!({
            "new_account_id": new_account_id,
            "new_public_key": key.public_key().to_string(),
        }))
        .deposit(NearToken::from_millinear(100))
        .gas(Gas::from_tgas(30))
        .await?;

    println!("Created top-level account: {new_account_id}");
    println!("Private key: {key}");

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/create_tla.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="seed phrase">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/create_account_from_seed.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="create_account_from_seed.rs" lines
use near_kit::signer::SecretKey;
use near_kit::{Error, Gas, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Generate a new seed phrase and derive its key (path m/44'/397'/0')
    let (seed_phrase, key) = SecretKey::generate_with_seed_phrase()?;

    // Create a unique top-level account name using the timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let new_account_id = format!("{timestamp}.testnet");

    // Create the top-level account by calling the testnet contract
    near.call("testnet", "create_account")
        .args(serde_json::json!({
            "new_account_id": new_account_id,
            "new_public_key": key.public_key().to_string(),
        }))
        .deposit(NearToken::from_millinear(100))
        .gas(Gas::from_tgas(30))
        .await?;

    println!("Created account: {new_account_id}");
    println!("Seed phrase: {seed_phrase}");

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/create_account_from_seed.rs)

</div>

{/* /github-code */}

  </Tab>
  </Tabs>

  </Tab>
  <Tab title="🐍 near-kit-py">

  <Tabs>
  <Tab title="random key">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/create_tla.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="create_tla.py" lines
import os
import time

from dotenv import load_dotenv
from near import Near, generate_key

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Generate a new key pair for the top-level account
key = generate_key()

# Create a unique top-level account name using the timestamp
new_account_id = f"{int(time.time() * 1000)}.testnet"

# Create the top-level account by calling the testnet contract
client.call(
    "testnet",
    "create_account",
    {"new_account_id": new_account_id, "new_public_key": str(key.public_key)},
    deposit="0.1 NEAR",
    gas="30 Tgas",
)

print(f"Created top-level account: {new_account_id}")
print(f"Private key: {key.secret_key}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/create_tla.py)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="seed phrase">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/create_account_from_seed.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="create_account_from_seed.py" lines
import os
import time

from dotenv import load_dotenv
from near import Near, generate_seed_phrase, key_from_seed_phrase

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Generate a new seed phrase and derive its key (path m/44'/397'/0')
seed_phrase = generate_seed_phrase()
key = key_from_seed_phrase(seed_phrase)

# Create a unique top-level account name using the timestamp
new_account_id = f"{int(time.time() * 1000)}.testnet"

# Create the top-level account by calling the testnet contract
client.call(
    "testnet",
    "create_account",
    {"new_account_id": new_account_id, "new_public_key": str(key.public_key)},
    deposit="0.1 NEAR",
    gas="30 Tgas",
)

print(f"Created account: {new_account_id}")
print(f"Seed phrase: {seed_phrase}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/create_account_from_seed.py)

</div>

{/* /github-code */}

  </Tab>
  </Tabs>

  </Tab>
</Tabs>

### Create Sub-Account

Accounts on NEAR can create sub-accounts under their own namespace, which is useful for organizing accounts by purpose — for example, `project.user.testnet`.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/create-subaccount.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="create-subaccount.ts" lines
import dotenv from "dotenv";
import { Account, JsonRpcProvider, KeyPair, KeyPairString, nearToYocto } from "near-api-js";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const account = new Account(accountId, provider, privateKey); // example-account.testnet

// Generate a new account prefix and key pair
const prefix: string = Date.now().toString();
const keyPair = KeyPair.fromRandom("ed25519");
const publicKey: string = keyPair.getPublicKey().toString();

await account.createSubAccount({
  accountOrPrefix: prefix,    // prefix for the sub account (e.g. sub.near.testnet)
  publicKey, // ed25519:2ASWc...
  nearToTransfer: nearToYocto("0") // Initial balance for new account in yoctoNEAR
});

console.log(`Created ${prefix}.${accountId} with private key ${keyPair.toString()}`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/create-subaccount.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/create-subaccount.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="create-subaccount.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near, generateKey } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Generate a new key pair for the subaccount
const keyPair = generateKey();
const publicKey = keyPair.publicKey.toString();

// Create a unique subaccount name using timestamp
const prefix = Date.now().toString();
const newAccountId = `${prefix}.${accountId}`;

// Create the subaccount using transaction builder with chained actions
await near
  .transaction(accountId)
  .createAccount(newAccountId)
  .transfer(newAccountId, "0.1 NEAR")
  .addKey(publicKey, { type: "fullAccess" })
  .send();

console.log(`Created subaccount: ${newAccountId}`);
console.log(`Private key: ${keyPair.secretKey}`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/create-subaccount.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/create_account.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 61
end: 76
fname: create_account.rs
language: rust
*/}

```rust title="create_account.rs" lines
    let private_key = signer::generate_secret_key().unwrap();
    let create_sub_account_result = Account::create_account(sub_account_id.clone()) // sub.example-account.testnet
        .fund_myself(
            account_id.clone(),
            NearToken::from_millinear(100), // Initial balance for sub account in yoctoNEAR
        )
        .with_public_key(private_key.public_key())
        .with_signer(signer.clone()) // Signer is the account that is creating the sub account
        .send_to(&network)
        .await
        .unwrap();

    println!("Private key: {:?}", private_key.to_string());
    println!("Public key: {:?}", private_key.public_key().to_string());
    println!("{:?}", create_sub_account_result);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/create_account.rs#L61-L76)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/create_subaccount.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="create_subaccount.rs" lines
use near_kit::signer::SecretKey;
use near_kit::{Error, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Generate a new key pair for the subaccount
    let key = SecretKey::generate_ed25519();

    // Create a unique subaccount name using the timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let new_account_id = format!("{timestamp}.{account_id}");

    // Create the subaccount, fund it and add a key in one atomic transaction
    near.transaction(&new_account_id)
        .create_account()
        .transfer(NearToken::from_millinear(100))
        .add_full_access_key(key.public_key())
        .send()
        .await?;

    println!("Created subaccount: {new_account_id}");
    println!("Private key: {key}");

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/create_subaccount.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/create_subaccount.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="create_subaccount.py" lines
import os
import time

from dotenv import load_dotenv
from near import Near, add_full_access_key, create_account, generate_key, transfer

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Generate a new key pair for the subaccount
key = generate_key()

# Create a unique subaccount name using the timestamp
new_account_id = f"{int(time.time() * 1000)}.{account_id}"

# Create the subaccount, fund it and add a key in one atomic transaction
client.send_transaction(
    new_account_id,
    actions=[create_account(), transfer("0.1 NEAR"), add_full_access_key(key.public_key)],
)

print(f"Created subaccount: {new_account_id}")
print(f"Private key: {key.secret_key}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/create_subaccount.py)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

<Info>
Parent accounts have **no control** over their sub-accounts, they are completely independent.
</Info>

### Create Deterministic Account

Use `near-kit` to create a [deterministic account](/protocol/accounts-contracts/account-id#deterministic-address) from a global contract and initial storage. The library derives the `0s` address from the state init.

```javascript
import { Near } from "near-kit";

const near = new Near({
  network: "testnet",
  privateKey: "ed25519:<alice-private-key>",
  defaultSignerId: "alice.testnet",
});

await near
  .transaction("alice.testnet")
  .stateInit({
    code: { accountId: "publisher.testnet" },
    data: new Map(),
    deposit: "0.1 NEAR",
  })
  .send();
```

Replace `publisher.testnet` with an account that has already deployed a global contract. `data` maps storage keys to values as `Uint8Array` bytes; an empty map starts with empty storage. The deposit covers storage costs, and any excess is refunded.

See the [`near-kit` deterministic account guide](https://github.com/r-near/near-kit/blob/main/docs/in-depth/global-contracts.mdx#4-deterministic-account-ids-nep-616) for initial storage and address derivation examples.

### Delete Account

Accounts on NEAR can delete themselves, transferring any remaining balance to a specified beneficiary account.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/delete-account.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 26
end: 30
language: javascript
*/}

```javascript title="delete-account.ts" lines
const accountToDelete = new Account(deleteMe, provider, privateKey);

// Delete the account 
const beneficiary: string = process.env.ACCOUNT_ID!;
await accountToDelete.deleteAccount(beneficiary);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/delete-account.ts#L26-L30)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/delete-account.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="delete-account.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near, generateKey } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Generate a new key pair for the account to be deleted
const keyPair = generateKey();
const publicKey = keyPair.publicKey.toString();

// Create a unique top-level account name using timestamp
const accountToDelete = `${Date.now()}.testnet`;

// First, create the account by calling the testnet contract
await near.call("testnet", "create_account", {
  new_account_id: accountToDelete,
  new_public_key: publicKey,
});

console.log(`Created account: ${accountToDelete}`);

// Fund the new account so it can pay for the delete transaction
await near.send(accountToDelete, "0.01 NEAR");
console.log(`Funded account with 0.01 NEAR`);

// Create a new Near instance with the new account's key to delete it
const nearForNewAccount = new Near({
  network: "testnet",
  privateKey: privateKeyFromString(keyPair.secretKey),
  defaultSignerId: accountToDelete,
});

// Delete the account, sending remaining balance to beneficiary
await nearForNewAccount
  .transaction(accountToDelete)
  .deleteAccount({ beneficiary: accountId })
  .send();

console.log(`Deleted account: ${accountToDelete}`);
console.log(`Beneficiary: ${accountId}`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/delete-account.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/delete_account.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 51
end: 59
fname: delete_account.rs
language: rust
*/}

```rust title="delete_account.rs" lines
    // Delete the account with account Id of the account object
    let delete_account_result = account_to_delete
        .delete_account_with_beneficiary(beneficiary_account_id.clone()) // example-beneficiary.testnet
        .with_signer(signer.clone()) // Signer is the account that is being deleted
        .send_to(&network)
        .await
        .unwrap();
    println!("{:?}", delete_account_result);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/delete_account.rs#L51-L59)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/delete_account.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="delete_account.rs" lines
use near_kit::signer::{InMemorySigner, SecretKey};
use near_kit::transaction::Final;
use near_kit::{Error, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Create a subaccount that we will delete afterwards
    let key = SecretKey::generate_ed25519();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let account_to_delete = format!("{timestamp}.{account_id}");

    near.transaction(&account_to_delete)
        .create_account()
        .transfer(NearToken::from_millinear(10))
        .add_full_access_key(key.public_key())
        .send()
        .wait_until::<Final>()
        .await?;
    println!("Created account: {account_to_delete}");

    // Sign as the new account, reusing the same RPC connection
    let new_account = near.with_signer(InMemorySigner::from_secret_key(
        account_to_delete.as_str(),
        key,
    )?);

    // Delete the account, sending the remaining balance to the beneficiary
    new_account
        .transaction(&account_to_delete)
        .delete_account(&account_id)
        .send()
        .await?;

    println!("Deleted account: {account_to_delete}");
    println!("Beneficiary: {account_id}");

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/delete_account.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/delete_account.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="delete_account.py" lines
import os
import time

from dotenv import load_dotenv
from near import (
    KeyPairSigner,
    Near,
    add_full_access_key,
    create_account,
    delete_account,
    generate_key,
    transfer,
)

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Create a subaccount that we will delete afterwards
key = generate_key()
account_to_delete = f"{int(time.time() * 1000)}.{account_id}"

client.send_transaction(
    account_to_delete,
    actions=[create_account(), transfer("0.01 NEAR"), add_full_access_key(key.public_key)],
    wait_until="FINAL",
)
print(f"Created account: {account_to_delete}")

# Sign as the new account, reusing the same connection
new_account = client.with_signer(KeyPairSigner(account_to_delete, key))

# Delete the account, sending the remaining balance to the beneficiary
new_account.send_transaction(account_to_delete, actions=[delete_account(account_id)])

print(f"Deleted account: {account_to_delete}")
print(f"Beneficiary: {account_id}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/delete_account.py)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

<Info>
Deleting an account **DOES NOT** affect its sub-accounts - they will remain active.
</Info>

<Danger>
**The Beneficiary Only Receives NEAR Tokens**

Fungible (FTs) or Non-Fungible tokens (NFTs) held by the account **ARE NOT** automatically transferred. These tokens are still associated with the account, even after the account is deleted. Make sure to transfer those assets manually before deletion, or you're risking losing them permanently. Once the account is gone, those assets are effectively stuck unless the same account is recreated by anyone (not necessarily you).
</Danger>

<Danger>
**Make Sure the Beneficiary Account Exists**

If the beneficiary account doesn't exist, all NEAR tokens sent to it will be burned. Double-check the account ID before proceeding.
</Danger>

---

## Transactions

### Send Tokens

Accounts can transfer different types of tokens to other accounts, including the native NEAR token and [NEP-141](https://github.com/near/NEPs/tree/master/neps/nep-0141.md) fungible tokens.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/send-tokens.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="send-tokens.ts" lines
import dotenv from "dotenv";
import { Account, JsonRpcProvider, KeyPairString } from "near-api-js";
import { NEAR, FungibleToken } from "near-api-js/tokens";
import { USDT } from "near-api-js/tokens/testnet";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const account = new Account(accountId, provider, privateKey); // example-account.testnet

// ------- Send NEAR tokens to another account -------
const sendNearTokensResult = await account.transfer({
  token: NEAR,
  amount: NEAR.toUnits("0.1"),
  receiverId: "influencer.testnet"
});
console.log(sendNearTokensResult);

// ------- Send USDT tokens to another account -------
// NOTE: Use https://testnet.rhea.finance/#near|usdtt.fakes.testnet to get USDT token
const sendUsdtTokensResult = await account.transfer({
  token: USDT,
  amount: USDT.toUnits("1"), // Amount of USDT being sent
  receiverId: "influencer.testnet"
});
console.log(sendUsdtTokensResult);

// ------- Send REF tokens to another account -------
// Use https://testnet.rhea.finance/#near|ref.fakes.testnet to get REF tokens
const REF = new FungibleToken("ref.fakes.testnet", {
  decimals: 18,
  symbol: "REF",
  name: "REF Token",
});

const sendREFsResult = await account.transfer({
  token: REF,
  amount: REF.toUnits("1"), // Amount of REF tokens being sent
  receiverId: "influencer.testnet"
}).catch(() => {}); // ignore errors if already registered

console.log(sendREFsResult);

// Lower level Primitives
console.log(
  "Is influencer.testnet registered for USDT?",
  await USDT.isAccountRegistered({
    accountId: "influencer.testnet",
    provider,
  })
)

console.log(
  "Registering influencer.testnet for USDT",
  await USDT.registerAccount({
    accountIdToRegister: "influencer.testnet",
    fundingAccount: account,
  })
)

// ------- Sending tokens to an unregistered account will automatically register it -------
const randomAccountId = `${Math.random().toString(36).substring(2, 15)}.testnet`;

const isRegistered = await USDT.isAccountRegistered({
    accountId: randomAccountId,
    provider,
  })

if (isRegistered) throw new Error(`${randomAccountId} is already registered`);

await account.transfer({
  token: USDT,
  amount: USDT.toUnits("1"),
  receiverId: randomAccountId,
});

const randomAccount = new Account(randomAccountId, provider);
const balance = await USDT.getBalance(randomAccount);
console.log(`Balance of ${randomAccountId}:`, USDT.toDecimal(balance));
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/send-tokens.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/send-tokens.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="send-tokens.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Send NEAR tokens to another account
const result = await near.send("receiver-account.testnet", "0.1 NEAR");

console.log("Transfer result:", result);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/send-tokens.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/send_tokens.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 22
end: 28
fname: send_tokens.rs
language: rust
*/}

```rust title="send_tokens.rs" lines
let send_tokens_result = Tokens::account(account_id.clone()) // example-account.testnet
    .send_to("receiver-account.testnet".parse().unwrap())
    .near(NearToken::from_near(1))
    .with_signer(signer.clone())
    .send_to(&network)
    .await
    .unwrap();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/send_tokens.rs#L22-L28)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/send_tokens.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="send_tokens.rs" lines
use near_kit::{Error, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Send NEAR tokens to another account
    let outcome = near
        .transfer("receiver-account.testnet", NearToken::from_millinear(100))
        .await?;

    println!("Transfer result: {:?}", outcome.transaction_hash());

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/send_tokens.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/send_tokens.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="send_tokens.py" lines
import os

from dotenv import load_dotenv
from near import Near

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Send NEAR tokens to another account
result = client.send("receiver-account.testnet", "0.1 NEAR")

print(f"Transfer result: {result.transaction_hash}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/send_tokens.py)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

### Call Function

A smart contract exposes its methods, and making a function call that modifies state requires a `Signer`/`KeyPair`. You can optionally attach a `NEAR` deposit to the call.

<Tabs>
  <Tab title="🌐 near-api-js">

  <Tabs>
    <Tab title="function call">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/contract-interaction.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="contract-interaction.ts" lines
import dotenv from "dotenv";
import { Account, JsonRpcProvider, teraToGas, KeyPairString, nearToYocto } from "near-api-js";

// Create an account object
dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a testnet provider
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// For read only calls, you can use the provider directly
const messages = await provider.callFunction({
  contractId: 'guestbook.near-examples.testnet',
  method: "get_messages",
  args: {},
});

console.log(messages);

// To modify state, you need an account to sign the transaction
const account = new Account(accountId, provider, privateKey);

// Call the contract
await account.callFunction({
  contractId: 'guestbook.near-examples.testnet',
  methodName: "add_message",
  args: { text: "Hello!" },
  gas: teraToGas('30'),
  deposit: nearToYocto('0.1'),
});
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/contract-interaction.ts)

</div>

{/* /github-code */}
      <Tip>
      When using Typescript, you can type the return of `callFunction<T>`.
      </Tip>
    </Tab>
    <Tab title="typed contract">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/typed-contract-interaction.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="typed-contract-interaction.ts" lines
import { nearToYocto, Account, Contract, JsonRpcProvider, KeyPairString } from "near-api-js";
import abi from "./guestbook.abi.js";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const account = new Account(accountId, provider, privateKey); // example-account.testnet

// Make a function call that modifies state
const contract = new Contract({
  contractId: "guestbook.near-examples.testnet",
  provider: provider,
  abi: abi,
});

contract.call.add_message({
  deposit: nearToYocto("0.1"),
  args: { text: "Hello, NEAR!" },
  account: account,
}); // TypeScript infers the type of this method

// Make a read-only function call
const totalMessages = await contract.view.total_messages();
console.log({ totalMessages });

// Send a tx to add message
const result = await contract.call.add_message({
  account,
  args: { text: "Hello, world!" },
});

console.log({ result });
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/typed-contract-interaction.ts)

</div>

{/* /github-code */}
    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🌐 near-kit">

  <Tabs>
    <Tab title="function call">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/contract-interaction.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="contract-interaction.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import dotenv from "dotenv";
import { Near } from "near-kit";

// Create a connection to testnet with credentials
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

const near = new Near({
  network: "testnet",
  privateKey,
  defaultSignerId: accountId
});

// For read only calls, you can use the provider directly
const messages = await near.view(
  'guestbook.near-examples.testnet',
  'get_messages',
  {}
);

console.log(messages);

// To modify state, call the contract method
await near.call(
  'guestbook.near-examples.testnet',
  'add_message',
  { text: "Hello!" },
  { gas: "30 Tgas" }
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/contract-interaction.js)

</div>

{/* /github-code */}
      <Tip>
      When using Typescript, you can type the return of `Near.view<T>` and `Near.call<T>`.
      </Tip>
    </Tab>
    <Tab title="typed contract">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/typed-contract-interaction.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="typed-contract-interaction.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near } from "near-kit";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

// Create a connection to testnet with credentials from environment
const near = new Near({
  network: "testnet",
  privateKey: privateKeyFromString(process.env.PRIVATE_KEY),
  defaultSignerId: process.env.ACCOUNT_ID
});

// Define the contract interface
const guestbook = near.contract("guestbook.near-examples.testnet");

// View: get total messages
const totalMessages = await guestbook.view.total_messages();
console.log({ totalMessages });

// Call: add a message
const result = await guestbook.call.add_message({ text: "Hello from near-kit!" }, { gas: "30 Tgas" });
console.log({ result });
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/typed-contract-interaction.js)

</div>

{/* /github-code */}
    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/contract_interaction.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 23
end: 24
fname: contract_interaction.rs
language: rust
*/}

```rust title="contract_interaction.rs" lines
let contract_id: AccountId = "guestbook.near-examples.testnet".parse().unwrap();
let contract = Contract(contract_id.clone());
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/contract_interaction.rs#L23-L24)

</div>

{/* /github-code */}

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/contract_interaction.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 36
end: 47
fname: contract_interaction.rs
language: rust
*/}

```rust title="contract_interaction.rs" lines
let args = json!({
    "text": "Hello, world!"
});

let function_call_result = contract
    .call_function("add_message", args)
    .transaction()
    .deposit(NearToken::from_near(1))
    .with_signer(account_id.clone(), signer.clone()) // Signer is the account that is calling the function
    .send_to(&network)
    .await
    .unwrap();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/contract_interaction.rs#L36-L47)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/contract_interaction.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 27
end: 31
*/}

```rust title="contract_interaction.rs" lines
// To modify state, call the contract method
near.call("guestbook.near-examples.testnet", "add_message")
    .args(serde_json::json!({ "text": "Hello!" }))
    .gas(Gas::from_tgas(30))
    .await?;
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/contract_interaction.rs#L27-L31)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/contract_interaction.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 23
end: 24
*/}

```python title="contract_interaction.py" lines
# To modify state, call the contract method
client.call("guestbook.near-examples.testnet", "add_message", {"text": "Hello!"}, gas="30 Tgas")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/contract_interaction.py#L23-L24)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

### Batch Actions

You can send multiple [actions](/protocol/transactions/transaction-anatomy#actions) in a batch to a **single** receiver. If one action fails then the entire batch of actions will be reverted.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/batch-actions.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="batch-actions.ts" lines
import dotenv from "dotenv";
import { Account, JsonRpcProvider, actions, teraToGas, nearToYocto, KeyPairString } from "near-api-js";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const account = new Account(accountId, provider, privateKey); // example-account.testnet

// Send the batch of actions
const batchActionsResult = await account.signAndSendTransaction({
  receiverId: "counter.near-examples.testnet",
  actions: [
    actions.functionCall("increment", {}, teraToGas("30"), 0n),
    actions.transfer(nearToYocto("0.001"))
  ],
});

console.log(batchActionsResult);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/batch-actions.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/batch-actions.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="batch-actions.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Batch multiple actions in one transaction
const result = await near.transaction(accountId)
  .functionCall("counter.near-examples.testnet", "increment", {}, { gas: "30 Tgas" })
  .transfer("counter.near-examples.testnet", "0.001 NEAR")
  .send();

console.log("Batch actions result:", result);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/batch-actions.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/batch_actions.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 22
end: 42
fname: batch_actions.rs
language: rust
*/}

```rust title="batch_actions.rs" lines
// Prepare the actions
let call_action = Action::FunctionCall(Box::new(FunctionCallAction {
    method_name: "increment".to_string(),
    args: serde_json::json!({}).to_string().into_bytes(),
    gas: near_api::NearGas::from_tgas(30),
    deposit: near_api::NearToken::from_yoctonear(0),
}));
let transfer_action = Action::Transfer(TransferAction {
    deposit: near_api::NearToken::from_near(1),
}); // Transfer 1 NEAR

// Send the batch of actions
let batch_actions_result = Transaction::construct(
    account_id.clone(),
    "counter.near-examples.testnet".parse().unwrap(),
)
.add_actions(vec![call_action, transfer_action])
.with_signer(signer)
.send_to(&network)
.await
.unwrap();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/batch_actions.rs#L22-L42)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/batch_actions.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="batch_actions.rs" lines
use near_kit::{Error, Gas, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Batch multiple actions in one atomic transaction to the same receiver
    let outcome = near
        .transaction("counter.near-examples.testnet")
        .call("increment")
        .gas(Gas::from_tgas(30))
        .finish()
        .transfer(NearToken::from_millinear(1))
        .send()
        .await?;

    println!("Batch actions result: {:?}", outcome.transaction_hash());

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/batch_actions.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/batch_actions.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="batch_actions.py" lines
import os

from dotenv import load_dotenv
from near import Near, function_call, transfer

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Batch multiple actions in one atomic transaction to the same receiver
result = client.send_transaction(
    "counter.near-examples.testnet",
    actions=[function_call("increment", gas="30 Tgas"), transfer("0.001 NEAR")],
)

print(f"Batch actions result: {result.transaction_hash}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/batch_actions.py)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

### Simultaneous Transactions

The only way to have true simultaneous transactions is to use multiple access keys on a same account. Each access key maintains its own nonce, allowing transactions signed with different keys to be processed in parallel:

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/simultaneous-transactions.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="simultaneous-transactions.ts" lines
import dotenv from "dotenv";
import { NEAR } from "near-api-js/tokens";
import { Account, actions, JsonRpcProvider, KeyPair, MultiKeySigner, KeyPairString } from "near-api-js";

dotenv.config({ path: "../.env" }); // Loads .env
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create 10 keys and add them to the account
const account = new Account(accountId, provider, privateKey);

const keys: KeyPair[] = [];
const txActions: ReturnType<typeof actions.addFullAccessKey>[] = [];
for (let j = 0; j < 10; j++) {
  const newKeyPair = KeyPair.fromRandom('ed25519');
  keys.push(newKeyPair);
  txActions.push(actions.addFullAccessKey(newKeyPair.getPublicKey()));
}

await account.signAndSendTransaction({
  receiverId: accountId,
  actions: txActions
});

// Send NEAR tokens using multiple keys
const multiKeySigner = new MultiKeySigner(keys);
const multiAccount = new Account(accountId, provider, multiKeySigner);

const transfers = [...Array(100)].map(() =>
  multiAccount.transfer({
    token: NEAR,
    amount: NEAR.toUnits("0.001"),
    receiverId: "influencer.testnet"
  })
);

const sendNearTokensResults = await Promise.all(transfers);
sendNearTokensResults.forEach(result => console.log(result));
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/simultaneous-transactions.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/simultaneous-transactions.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="simultaneous-transactions.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near, generateKey, RotatingKeyStore } from "near-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a RotatingKeyStore for concurrent transactions
const keyStore = new RotatingKeyStore();

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Add multiple keys to the account for concurrent transactions
const keys = [];
for (let i = 0; i < 5; i++) {
  const newKey = generateKey();
  keys.push(newKey);

  // Add key to the account on-chain
  await near
    .transaction(accountId)
    .addKey(newKey.publicKey.toString(), { type: "fullAccess" })
    .send();

  // Add key to the rotating store
  await keyStore.add(accountId, newKey);
}

console.log(`Added ${keys.length} keys to account`);

// Create a new Near client with the rotating keystore
const nearWithRotating = new Near({
  network: "testnet",
  keyStore,
  defaultSignerId: accountId,
});

// Send multiple concurrent transactions
// The RotatingKeyStore will distribute keys to avoid nonce conflicts
const transfers = Array.from({ length: 10 }, (_, i) =>
  nearWithRotating.send("influencer.testnet", "0.001 NEAR")
);

const results = await Promise.all(transfers);
console.log(`Completed ${results.length} concurrent transfers`);

// Clean up: delete the keys we added
for (const key of keys) {
  await near
    .transaction(accountId)
    .deleteKey(accountId, key.publicKey.toString())
    .send();
}

console.log("Cleaned up keys");
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/simultaneous-transactions.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/simultaneous_transactions.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 23
end: 55
fname: simultaneous_transactions.rs
language: rust
*/}

```rust title="simultaneous_transactions.rs" lines
// Prepare the transactions
let args = serde_json::to_vec(&json!({
    "text": "Hello, world!"
}))
.unwrap();
let action1 = Action::FunctionCall(Box::new(FunctionCallAction {
    method_name: "add_message".to_string(),
    args,
    gas: near_api::NearGas::from_tgas(100),
    deposit: near_api::NearToken::from_yoctonear(0),
}));
let tx1 = Transaction::construct(
    account_id.clone(),
    "guestbook.near-examples.testnet".parse().unwrap(),
)
.add_action(action1)
.with_signer(signer.clone());

let action2 = Action::FunctionCall(Box::new(FunctionCallAction {
    method_name: "increment".to_string(),
    args: b"{}".to_vec(),
    gas: near_api::NearGas::from_tgas(100),
    deposit: near_api::NearToken::from_yoctonear(0),
}));
let tx2 = Transaction::construct(
    account_id.clone(),
    "counter.near-examples.testnet".parse().unwrap(),
)
.add_action(action2)
.with_signer(signer.clone());

// Send the transactions simultaneously
let (tx1_result, tx2_result) = tokio::join!(tx1.send_to(&network), tx2.send_to(&network));
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/simultaneous_transactions.rs#L23-L55)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/simultaneous_transactions.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="simultaneous_transactions.rs" lines
use near_kit::{Error, Gas, Near};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Prepare the transactions
    let tx1 = near
        .call("guestbook.near-examples.testnet", "add_message")
        .args(serde_json::json!({ "text": "Hello, world!" }))
        .gas(Gas::from_tgas(30));
    let tx2 = near
        .call("counter.near-examples.testnet", "increment")
        .gas(Gas::from_tgas(30));

    // Send them at the same time: the client reserves a distinct nonce for each
    let (r1, r2) = tokio::try_join!(tx1, tx2)?;

    println!("Guestbook tx: {:?}", r1.transaction_hash());
    println!("Counter tx: {:?}", r2.transaction_hash());

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/simultaneous_transactions.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/simultaneous_transactions.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="simultaneous_transactions.py" lines
import asyncio
import os

from dotenv import load_dotenv
from near import AsyncNear

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]


async def main():
    # Create an async connection to testnet with signing capabilities
    async with AsyncNear(network="testnet", account_id=account_id, private_key=private_key) as client:
        # Prepare the transactions
        tx1 = client.call("guestbook.near-examples.testnet", "add_message", {"text": "Hello, world!"})
        tx2 = client.call("counter.near-examples.testnet", "increment")

        # Send them at the same time: the client reserves a distinct nonce for each
        results = await asyncio.gather(tx1, tx2)

        for result in results:
            print(f"Transaction: {result.transaction_hash}")


asyncio.run(main())
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/simultaneous_transactions.py)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

<Warning>
Simultaneous execution means there's no guarantee of order or success. Any transaction may fail independently. If your use case requires strict ordering, then you should stick to sending transactions sequentially from a single key.
</Warning>

### Deploy a Contract

On NEAR, a smart contract is deployed as a WASM file. Every account has the potential to become a contract — you simply need to deploy code to it.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/deploy-contract.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="deploy-contract.ts" lines
import { Account, JsonRpcProvider, KeyPairString } from "near-api-js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const account = new Account(accountId, provider, privateKey); // example-account.testnet

// Deploy a contract to the account
const result = await account.deployContract(
  fs.readFileSync("../contracts/contract.wasm") // Path of contract WASM relative to the working directory
);

console.log(result);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/deploy-contract.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/deploy-contract.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
language: javascript
*/}

```javascript title="deploy-contract.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near } from "near-kit";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Deploy a contract to the account
const wasmCode = fs.readFileSync("../contracts/contract.wasm");
const result = await near.transaction(accountId)
  .deployContract(accountId, wasmCode)
  .send();

console.log("Deploy contract result:", result);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/deploy-contract.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

  Note that the `signer` here needs to be a signer for the same `account_id` as the one used to construct the `Contract` object.

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/contract_interaction.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 52
end: 59
fname: contract_interaction.rs
language: rust
*/}

```rust title="contract_interaction.rs" lines
let deploy_result = Contract::deploy(account_id.clone())
    .use_code(include_bytes!("../../contracts/contract.wasm").to_vec()) // Path of contract WASM relative to this file
    .without_init_call()
    .with_signer(signer) // Signer is the account that is deploying the contract
    .send_to(&network)
    .await
    .unwrap();
println!("{:?}", deploy_result);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/contract_interaction.rs#L52-L59)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/deploy_contract.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```rust title="deploy_contract.rs" lines
use near_kit::{Error, Near};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Load environment variables
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");

    // Create a connection to testnet with signing capabilities
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Deploy a contract to the signer account
    let wasm_code = std::fs::read("../contracts/contract.wasm").expect("contract.wasm");
    let outcome = near.deploy(wasm_code).send().await?;

    println!("Deploy contract result: {:?}", outcome.transaction_hash());

    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/deploy_contract.rs)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/deploy_contract.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
*/}

```python title="deploy_contract.py" lines
import os

from dotenv import load_dotenv
from near import Near, deploy_contract

# Load environment variables
load_dotenv()
private_key = os.environ["PRIVATE_KEY"]
account_id = os.environ["ACCOUNT_ID"]

# Create a connection to testnet with signing capabilities
client = Near(network="testnet", account_id=account_id, private_key=private_key)

# Deploy a contract to the signer account
with open("../contracts/contract.wasm", "rb") as f:
    wasm_code = f.read()

result = client.send_transaction(account_id, actions=[deploy_contract(wasm_code)])

print(f"Deploy contract result: {result.transaction_hash}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/deploy_contract.py)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

### Deploy a Global Contract

[Global contracts](/smart-contracts/global-contracts) allow smart contracts to be deployed once and reused by any account without incurring high storage costs.

There are two ways to reference a global contract:
- **[By account](/smart-contracts/global-contracts#reference-by-account):** The contract code is tied to another account.
- **[By hash](/smart-contracts/global-contracts#reference-by-hash):** You reference the contract by its immutable code hash.

<Tabs>
  <Tab title="🌐 near-api-js">

  <Tabs>
    <Tab title="by account">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/deploy-global-contract-by-account.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 1
end: 22
language: javascript
*/}

```javascript title="deploy-global-contract-by-account.ts" lines
import { Account, JsonRpcProvider, KeyPair, KeyPairString } from "near-api-js";
import { NEAR } from "near-api-js/tokens";
import { readFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const deployer = new Account(accountId, provider, privateKey); // example-account.testnet

// Path of contract WASM relative to the working directory
const wasm: Uint8Array = new Uint8Array(readFileSync("../contracts/contract.wasm"));
const deployResult = await deployer.deployGlobalContract(wasm, "accountId");

console.log(deployResult);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/deploy-global-contract-by-account.ts#L1-L22)

</div>

{/* /github-code */}
    </Tab>
    <Tab title="by hash">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/deploy-global-contract-by-hash.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 1
end: 23
language: javascript
*/}

```javascript title="deploy-global-contract-by-hash.ts" lines
import { Account, JsonRpcProvider, KeyPair, KeyPairString, baseEncode } from "near-api-js";
import { NEAR } from "near-api-js/tokens";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
const privateKey = process.env.PRIVATE_KEY! as KeyPairString;
const accountId: string = process.env.ACCOUNT_ID!;

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Create an account object
const deployer = new Account(accountId, provider, privateKey); // example-account.testnet

// Path of contract WASM relative to the working directory
const wasm: Uint8Array = new Uint8Array(readFileSync("../contracts/contract.wasm"));
const deployResult = await deployer.deployGlobalContract(wasm, "codeHash");

console.log(deployResult);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/deploy-global-contract-by-hash.ts#L1-L23)

</div>

{/* /github-code */}
    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🌐 near-kit">

  <Tabs>
    <Tab title="by account">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/deploy-global-contract-by-account.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 1
end: 28
language: javascript
*/}

```javascript title="deploy-global-contract-by-account.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near, generateKey } from "near-kit";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Read the contract WASM
const wasmCode = fs.readFileSync("../contracts/contract.wasm");

// Publish as a global contract (identified by account ID)
// Other accounts can use this contract without deploying their own copy
const publishResult = await near
  .transaction(accountId)
  .publishContract(wasmCode, { identifiedBy: "account" })
  .send();

console.log("Published global contract:", publishResult.transaction.hash);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/deploy-global-contract-by-account.js#L1-L28)

</div>

{/* /github-code */}
    </Tab>
    <Tab title="by hash">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/deploy-global-contract-by-hash.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 1
end: 32
language: javascript
*/}

```javascript title="deploy-global-contract-by-hash.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import { Near, generateKey } from "near-kit";
import dotenv from "dotenv";
import fs from "fs";
import { createHash } from "crypto";

// Load environment variables
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

// Create a connection to testnet with signing capabilities
const near = new Near({
  network: "testnet",
  privateKey: privateKey, // ed25519:5Fg2...
  defaultSignerId: accountId, // example-account.testnet
});

// Read the contract WASM
const wasmCode = fs.readFileSync("../contracts/contract.wasm");

// Calculate the code hash (SHA-256)
const codeHash = createHash("sha256").update(wasmCode).digest();

// Publish as a global contract (identified by code hash)
// This creates an immutable contract reference
const publishResult = await near
  .transaction(accountId)
  .publishContract(wasmCode, { identifiedBy: "hash" })
  .send();

console.log("Published global contract by hash:", publishResult.transaction.hash);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/deploy-global-contract-by-hash.js#L1-L32)

</div>

{/* /github-code */}
    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🦀 near-api-rs">

  Once you've created an Account instance, you can deploy your regular contract as a global contract.

  <Tabs>
    <Tab title="by account">

    To deploy a global contract by account, use the `deploy_global_contract_code` function with the `as_account_id` method.

    ```rust
    let global_account_id: AccountId = "nft-contract.testnet".parse().unwrap();
    let code = std::fs::read("path/to/your/contract.wasm").unwrap();
    let signer = Signer::from_secret_key(private_key).unwrap();

    let result = Contract::deploy_global_contract_code(code)
        .as_account_id(global_account_id)
        .with_signer(signer)
        .send_to_testnet()
        .await.unwrap();
    ```

    [See full example on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/global_contract_accountid.rs)

    </Tab>
    <Tab title="by hash">

    To deploy a global contract by hash, use the `deploy_global_contract_code` function with the `as_hash` method.

    ```rust
    let account_id: AccountId = "my-account.testnet".parse().unwrap();
    let code = std::fs::read("path/to/your/contract.wasm").unwrap();
    let signer = Signer::from_secret_key(private_key).unwrap();

    let result = Contract::deploy_global_contract_code(code)
        .as_hash()
        .with_signer(account_id, signer)
        .send_to_testnet()
        .await.unwrap();
    ```

    [See full example on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/global_contract_hash.rs)

    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🦀 near-kit-rs">

  <Tabs>
  <Tab title="by account">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/deploy_global_contract_by_account.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 18
end: 32
*/}

```rust title="deploy_global_contract_by_account.rs" lines
// Read the contract WASM
let wasm_code = std::fs::read("../contracts/contract.wasm").expect("contract.wasm");

// Publish as a global contract identified by the account ID.
// Other accounts can use this contract without deploying their own copy,
// and re-publishing from this account updates all of them.
let outcome = near
    .publish(wasm_code, PublishMode::Updatable)
    .send()
    .wait_until::<Final>()
    .await?;
println!(
    "Published global contract: {:?}",
    outcome.transaction_hash()
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/deploy_global_contract_by_account.rs#L18-L32)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="by hash">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/deploy_global_contract_by_hash.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 18
end: 31
*/}

```rust title="deploy_global_contract_by_hash.rs" lines
// Read the contract WASM and compute its code hash
let wasm_code = std::fs::read("../contracts/contract.wasm").expect("contract.wasm");
let code_hash = CryptoHash::hash(&wasm_code);

// Publish as a global contract identified by its code hash (immutable)
let outcome = near
    .publish(wasm_code, PublishMode::Immutable)
    .send()
    .wait_until::<Final>()
    .await?;
println!(
    "Published global contract by hash: {:?}",
    outcome.transaction_hash()
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/deploy_global_contract_by_hash.rs#L18-L31)

</div>

{/* /github-code */}

  </Tab>
  </Tabs>

  </Tab>
  <Tab title="🐍 near-kit-py">

  <Tabs>
  <Tab title="by account">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/deploy_global_contract_by_account.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 25
end: 33
*/}

```python title="deploy_global_contract_by_account.py" lines
# Read the contract WASM
with open("../contracts/contract.wasm", "rb") as f:
    wasm_code = f.read()

# Publish as a global contract identified by the account ID.
# Other accounts can use this contract without deploying their own copy,
# and re-publishing from this account updates all of them.
result = client.send_transaction(account_id, actions=[publish_contract(wasm_code)])
print(f"Published global contract: {result.transaction_hash}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/deploy_global_contract_by_account.py#L25-L33)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="by hash">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/deploy_global_contract_by_hash.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 26
end: 35
*/}

```python title="deploy_global_contract_by_hash.py" lines
# Read the contract WASM and compute its code hash (SHA-256)
with open("../contracts/contract.wasm", "rb") as f:
    wasm_code = f.read()
code_hash = hashlib.sha256(wasm_code).digest()

# Publish as a global contract identified by its code hash (immutable)
result = client.send_transaction(
    account_id, actions=[publish_contract(wasm_code, identified_by="hash")], wait_until="FINAL"
)
print(f"Published global contract by hash: {result.transaction_hash}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/deploy_global_contract_by_hash.py#L26-L35)

</div>

{/* /github-code */}

  </Tab>
  </Tabs>

  </Tab>
</Tabs>

### Use a Global Contract

Once a [global contract](/smart-contracts/global-contracts) has been [deployed](#deploy-a-global-contract), here is how you can reference and use it from another account.

<Tabs>
  <Tab title="🌐 near-api-js">

  <Tabs>
    <Tab title="by account">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/deploy-global-contract-by-account.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 32
end: 41
language: javascript
*/}

```javascript title="deploy-global-contract-by-account.ts" lines
const consumer = new Account(
  consumerAccountId,
  provider,
  key.toString() as KeyPairString
);

await consumer.useGlobalContract({ accountId: deployer.accountId });

const contract = await consumer.getContractCode();
console.log("Size", contract.code.length, "Hash", contract.hash);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/deploy-global-contract-by-account.ts#L32-L41)

</div>

{/* /github-code */}
    </Tab>
    <Tab title="by hash">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/deploy-global-contract-by-hash.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 37
end: 51
language: javascript
*/}

```javascript title="deploy-global-contract-by-hash.ts" lines
const consumer = new Account(
  consumerAccountId,
  provider,
  key.toString() as KeyPairString
);

const useResult = await consumer.useGlobalContract({
  codeHash: Uint8Array.from(Buffer.from(hash, 'base64')),
});
console.log(useResult);
await provider.viewTransactionStatus({ txHash: useResult.transaction.hash, accountId: consumer.accountId });

const contract = await consumer.getContractCode();
console.log("Size", contract.code.length, "Hash", contract.hash);

```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/deploy-global-contract-by-hash.ts#L37-L51)

</div>

{/* /github-code */}
    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🌐 near-kit">

  <Tabs>
    <Tab title="by account">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/deploy-global-contract-by-account.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 30
end: 63
language: javascript
*/}

```javascript title="deploy-global-contract-by-account.js" lines
// Create a consumer account that will use the global contract
const consumerKey = generateKey();
const consumerAccountId = `${Date.now()}.${accountId}`;

await near
  .transaction(accountId)
  .createAccount(consumerAccountId)
  .transfer(consumerAccountId, "0.1 NEAR")
  .addKey(consumerKey.publicKey.toString(), { type: "fullAccess" })
  .send();

console.log("Created consumer account:", consumerAccountId);

// Consumer uses the global contract by referencing the publisher's account ID
const consumerNear = new Near({
  network: "testnet",
  privateKey: privateKeyFromString(consumerKey.secretKey),
  defaultSignerId: consumerAccountId,
});

await consumerNear
  .transaction(consumerAccountId)
  .deployFromPublished({ accountId: accountId })
  .send();

console.log("Consumer is now using global contract from:", accountId);

// Clean up: delete consumer account
await consumerNear
  .transaction(consumerAccountId)
  .deleteAccount({ beneficiary: accountId })
  .send();

console.log("Cleaned up consumer account");
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/deploy-global-contract-by-account.js#L30-L63)

</div>

{/* /github-code */}
    </Tab>
    <Tab title="by hash">
{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/deploy-global-contract-by-hash.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 37
end: 71
language: javascript
*/}

```javascript title="deploy-global-contract-by-hash.js" lines
// Create a consumer account
const consumerKey = generateKey();
const consumerAccountId = `${Date.now()}.${accountId}`;

const createResult = await near
  .transaction(accountId)
  .createAccount(consumerAccountId)
  .transfer(consumerAccountId, "0.1 NEAR")
  .addKey(consumerKey.publicKey.toString(), { type: "fullAccess" })
  .send();

await near.getTransactionStatus(createResult.transaction.hash, accountId, "FINAL");
console.log("Created consumer account:", consumerAccountId);

// Consumer uses the global contract by referencing the code hash
const consumerNear = new Near({
  network: "testnet",
  privateKey: privateKeyFromString(consumerKey.secretKey),
  defaultSignerId: consumerAccountId,
});

await consumerNear
  .transaction(consumerAccountId)
  .deployFromPublished({ codeHash: codeHash })
  .send();

console.log("Consumer is now using global contract by hash");

// Clean up: delete consumer account
await consumerNear
  .transaction(consumerAccountId)
  .deleteAccount({ beneficiary: accountId })
  .send();

console.log("Cleaned up consumer account");
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/deploy-global-contract-by-hash.js#L37-L71)

</div>

{/* /github-code */}
    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🦀 near-api-rs">

  <Tabs>
    <Tab title="by account">

    To reference a global contract by account, call `use_global_account_id` and pass the source `accountId` where the contract was originally deployed.

    ```rust
    let global_account_id: AccountId = "nft-contract.testnet".parse().unwrap();
    let my_account_id: AccountId = "my-contract.testnet".parse().unwrap();
    let my_signer = Signer::from_secret_key(private_key).unwrap();

    let result = Contract::deploy(my_account_id)
        .use_global_account_id(global_account_id)
        .without_init_call()
        .with_signer(my_signer)
        .send_to_testnet()
        .await.unwrap();
    ```

    [See full example on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/global_contract_accountid.rs)

    </Tab>
    <Tab title="by hash">

    To reference a global contract by hash, call `use_global_hash` and pass the source `hash` of the original contract.

    ```rust
    let global_hash: types::CryptoHash = "DxfRbrjT3QPmoANMDYTR6iXPGJr7xRUyDnQhcAWjcoFF".parse().unwrap();
    let account_id: AccountId = "my-contract.testnet".parse().unwrap();
    let signer = Signer::from_secret_key(private_key).unwrap();

    let result = Contract::deploy(account_id)
        .use_global_hash(global_hash)
        .without_init_call()
        .with_signer(signer)
        .send_to_testnet()
        .await.unwrap();
    ```

    [See full example on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/global_contract_hash.rs)

    </Tab>
  </Tabs>

  </Tab>
  <Tab title="🦀 near-kit-rs">

  <Tabs>
  <Tab title="by account">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/deploy_global_contract_by_account.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 51
end: 58
*/}

```rust title="deploy_global_contract_by_account.rs" lines
// The consumer uses the global contract by referencing the publisher's account ID
let consumer = near.with_signer(InMemorySigner::from_secret_key(
    consumer_account_id.as_str(),
    consumer_key,
)?);

consumer.deploy_from(&account_id).send().await?;
println!("Consumer is now using the global contract from: {account_id}");
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/deploy_global_contract_by_account.rs#L51-L58)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="by hash">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/deploy_global_contract_by_hash.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 50
end: 57
*/}

```rust title="deploy_global_contract_by_hash.rs" lines
// The consumer uses the global contract by referencing the code hash
let consumer = near.with_signer(InMemorySigner::from_secret_key(
    consumer_account_id.as_str(),
    consumer_key,
)?);

consumer.deploy_from(code_hash).send().await?;
println!("Consumer is now using the global contract {code_hash}");
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/deploy_global_contract_by_hash.rs#L50-L57)

</div>

{/* /github-code */}

  </Tab>
  </Tabs>

  </Tab>
  <Tab title="🐍 near-kit-py">

  <Tabs>
  <Tab title="by account">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/deploy_global_contract_by_account.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 46
end: 49
*/}

```python title="deploy_global_contract_by_account.py" lines
# The consumer uses the global contract by referencing the publisher's account ID
consumer = client.with_signer(KeyPairSigner(consumer_account_id, consumer_key))
consumer.send_transaction(consumer_account_id, actions=[use_global_contract(account_id=account_id)])
print(f"Consumer is now using the global contract from: {account_id}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/deploy_global_contract_by_account.py#L46-L49)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="by hash">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/deploy_global_contract_by_hash.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 48
end: 53
*/}

```python title="deploy_global_contract_by_hash.py" lines
# The consumer uses the global contract by referencing the code hash
consumer = client.with_signer(KeyPairSigner(consumer_account_id, consumer_key))
consumer.send_transaction(
    consumer_account_id, actions=[use_global_contract(code_hash=code_hash)], wait_until="FINAL"
)
print("Consumer is now using the global contract by hash")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/deploy_global_contract_by_hash.py#L48-L53)

</div>

{/* /github-code */}

  </Tab>
  </Tabs>

  </Tab>
</Tabs>

---

## View Function

View functions are read-only methods on a smart contract that do not modify state. You can call them without using an account or signing a transaction.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/contract-interaction.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 9
end: 21
language: javascript
*/}

```javascript title="contract-interaction.ts" lines
// Create a testnet provider
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// For read only calls, you can use the provider directly
const messages = await provider.callFunction({
  contractId: 'guestbook.near-examples.testnet',
  method: "get_messages",
  args: {},
});

console.log(messages);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/contract-interaction.ts#L9-L21)

</div>

{/* /github-code */}

  <Tip>
  When using Typescript, you can type the return of `callFunction<T>`.
  </Tip>

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/contract-interaction.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 1
end: 23
language: javascript
*/}

```javascript title="contract-interaction.js" lines
import { privateKeyFromString } from "./helpers/private-key.js";
import dotenv from "dotenv";
import { Near } from "near-kit";

// Create a connection to testnet with credentials
dotenv.config({ path: "../.env" });
const privateKey = privateKeyFromString(process.env.PRIVATE_KEY);
const accountId = process.env.ACCOUNT_ID;

const near = new Near({
  network: "testnet",
  privateKey,
  defaultSignerId: accountId
});

// For read only calls, you can use the provider directly
const messages = await near.view(
  'guestbook.near-examples.testnet',
  'get_messages',
  {}
);

console.log(messages);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/contract-interaction.js#L1-L23)

</div>

{/* /github-code */}

  <Tip>
  When using Typescript, you can type the return of `Near.view<T>`.
  </Tip>

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/contract_interaction.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 22
end: 32
fname: contract_interaction.rs
language: rust
*/}

```rust title="contract_interaction.rs" lines
// Create contract object
let contract_id: AccountId = "guestbook.near-examples.testnet".parse().unwrap();
let contract = Contract(contract_id.clone());

// Make a view call to a contract
let view_call_result: Data<u32> = contract
    .call_function("total_messages", ())
    .read_only()
    .fetch_from(&network)
    .await
    .unwrap();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/contract_interaction.rs#L22-L32)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/contract_interaction.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 15
end: 25
*/}

```rust title="contract_interaction.rs" lines
// Read-only calls do not need a signer
let total: u32 = near
    .view("guestbook.near-examples.testnet", "total_messages")
    .await?;
println!("Total messages: {total}");

let messages: Vec<serde_json::Value> = near
    .view("guestbook.near-examples.testnet", "get_messages")
    .args(serde_json::json!({ "from_index": "0", "limit": "10" }))
    .await?;
println!("Messages: {messages:#?}");
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/contract_interaction.rs#L15-L25)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/contract_interaction.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 14
end: 21
*/}

```python title="contract_interaction.py" lines
# Read-only calls do not need a signer
total = client.view("guestbook.near-examples.testnet", "total_messages")
print(f"Total messages: {total}")

messages = client.view(
    "guestbook.near-examples.testnet", "get_messages", {"from_index": "0", "limit": "10"}
)
print(messages)
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/contract_interaction.py#L14-L21)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

---

## Keys

### Get All Access Keys

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/keys.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 9
end: 16
language: javascript
*/}

```javascript title="keys.ts" lines
// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// Query keys with the provider
const keysProvider = await provider.viewAccessKeyList({ accountId });
console.log(keysProvider);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/keys.ts#L9-L16)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 22
end: 22
fname: keys.rs
language: rust
*/}

```rust title="keys.rs" lines
let keys = account.list_keys().fetch_from(&network).await.unwrap();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/keys.rs#L22-L22)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 16
end: 18
*/}

```rust title="keys.rs" lines
// List all access keys of the account
let keys = near.access_keys(&account_id).await?;
println!("Account has {} keys", keys.keys.len());
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/keys.rs#L16-L18)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/keys.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 21
end: 23
*/}

```python title="keys.py" lines
# List all access keys of the account
keys = client.access_keys(account_id)
print(f"Account has {len(keys)} keys")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/keys.py#L21-L23)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

### Add Full Access Key

A [Full Access key](/protocol/accounts-contracts/access-keys#full-access-keys) grants complete control over the account.

Anyone with this key can transfer funds, sign transactions, interact with contracts, or even delete the account entirely.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/keys.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 30
end: 37
language: javascript
*/}

```javascript title="keys.ts" lines
// New keys
const fullKeyPair = KeyPair.fromRandom("ed25519");
const fnKeyPair = KeyPair.fromRandom("ed25519");

// Add a Full Access Key
await account.addFullAccessKey(
  fullKeyPair.getPublicKey().toString() // ed25519:2ASWc...
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/keys.ts#L30-L37)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/keys.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 17
end: 28
language: javascript
*/}

```javascript title="keys.js" lines
// Generate new key pairs
const fullAccessKey = generateKey();
const functionCallKey = generateKey();

console.log("Generated Full Access Key:", fullAccessKey.publicKey.toString());
console.log("Generated Function Call Key:", functionCallKey.publicKey.toString());

// Add a Full Access Key using transaction builder
await near
  .transaction(accountId)
  .addKey(fullAccessKey.publicKey.toString(), { type: "fullAccess" })
  .send();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/keys.js#L17-L28)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 25
end: 40
fname: keys.rs
language: rust
*/}

```rust title="keys.rs" lines
// Add full access key
let new_full_private_key = signer::generate_secret_key().unwrap(); // Get the private key from the keypair
let add_full_key_result = account
    .add_key(
        AccessKeyPermission::FullAccess,
        new_full_private_key.public_key(),
    )
    .with_signer(signer.clone())
    .send_to(&network)
    .await
    .unwrap();

let new_full_public_key = new_full_private_key.public_key().to_string();
println!("{:?}", new_full_public_key);
println!("{:?}", add_full_key_result);

```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/keys.rs#L25-L40)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 20
end: 28
*/}

```rust title="keys.rs" lines
// Generate new key pairs
let full_access_key = SecretKey::generate_ed25519();
let function_call_key = SecretKey::generate_ed25519();

// Add a Full Access Key
near.add_full_access_key(full_access_key.public_key())
    .send()
    .await?;
println!("Added Full Access Key: {}", full_access_key.public_key());
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/keys.rs#L20-L28)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/keys.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 25
end: 31
*/}

```python title="keys.py" lines
# Generate new key pairs
full_access_key = generate_key()
function_call_key = generate_key()

# Add a Full Access Key
client.send_transaction(account_id, actions=[add_full_access_key(full_access_key.public_key)])
print(f"Added Full Access Key: {full_access_key.public_key}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/keys.py#L25-L31)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

### Add Function Call Key

A [Function Call access key](/protocol/accounts-contracts/access-keys#function-call-keys) is designed specifically to sign transactions that include only [`functionCall` actions](/protocol/transactions/transaction-anatomy#actions) to a specific contract.

You can further restrict this key by:
- Limiting which method names can be called
- Capping the amount of `NEAR` the key can spend on transaction fees

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/keys.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 39
end: 45
language: javascript
*/}

```javascript title="keys.ts" lines
// Add Function Call Access Key
await account.addFunctionCallAccessKey({
  publicKey: fnKeyPair.getPublicKey(), // The new public key ed25519:2ASWc...
  contractId: "example-contract.testnet", // Contract this key is allowed to call (optional)
  methodNames: ["example_method"], // Methods this key is allowed to call (optional)
  allowance: NEAR.toUnits("0.25") // Gas allowance key can use to call methods (optional)
});
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/keys.ts#L39-L45)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/keys.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 32
end: 43
language: javascript
*/}

```javascript title="keys.js" lines
// Add a Function Call Access Key using transaction builder
await near
  .transaction(accountId)
  .addKey(functionCallKey.publicKey.toString(), {
    type: "functionCall",
    receiverId: "example-contract.testnet",
    methodNames: ["example_method"],
    allowance: "0.25 NEAR",
  })
  .send();

console.log(`Added Function Call Key: ${functionCallKey.publicKey.toString()}`);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/keys.js#L32-L43)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 41
end: 59
fname: keys.rs
language: rust
*/}

```rust title="keys.rs" lines
// Add function call access key
let new_function_call_key = AccessKeyPermission::FunctionCall(FunctionCallPermission {
    allowance: Some(near_api::NearToken::from_millinear(250)), // Gas allowance key can use to call methods (optional)
    receiver_id: "example-contract.testnet".to_string(), // Contract this key is allowed to call
    method_names: vec!["example_method".to_string()],    // Methods this key is allowed to call
});

let new_function_private_key = signer::generate_secret_key().unwrap();
let add_function_key_result = account
    .add_key(new_function_call_key, new_function_private_key.public_key())
    .with_signer(signer.clone())
    .send_to(&network)
    .await
    .unwrap();

let new_function_public_key = new_function_private_key.public_key().to_string();
println!("{:?}", new_function_public_key);
println!("{:?}", add_function_key_result);

```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/keys.rs#L41-L59)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 30
end: 43
*/}

```rust title="keys.rs" lines
// Add a Function Call Access Key
near.transaction(&account_id)
    .add_function_call_key(
        function_call_key.public_key(),
        "example-contract.testnet", // contract this key is allowed to call
        vec!["example_method".to_string()], // methods it can call (empty = all)
        Some(NearToken::from_millinear(250)), // gas allowance (None = unlimited)
    )
    .send()
    .await?;
println!(
    "Added Function Call Key: {}",
    function_call_key.public_key()
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/keys.rs#L30-L43)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/keys.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 33
end: 45
*/}

```python title="keys.py" lines
# Add a Function Call Access Key
client.send_transaction(
    account_id,
    actions=[
        add_function_call_key(
            function_call_key.public_key,
            "example-contract.testnet",  # contract this key is allowed to call
            ["example_method"],  # methods it can call (optional, empty = all)
            allowance="0.25 NEAR",  # gas allowance (optional)
        )
    ],
)
print(f"Added Function Call Key: {function_call_key.public_key}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/keys.py#L33-L45)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

<Tip>
For security reasons, Function Call access keys **can only be used with function calls that attach zero `NEAR` tokens**. Any attempt to include a deposit will result in a failed transaction.
</Tip>

### Delete Access Key

Accounts on NEAR can delete their own keys.

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/keys.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 56
end: 56
language: javascript
*/}

```javascript title="keys.ts" lines
await account.deleteKey(fnKeyPair.getPublicKey().toString());
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/keys.ts#L56-L56)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/keys.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 46
end: 55
language: javascript
*/}

```javascript title="keys.js" lines
const nearWithNewKey = new Near({
  network: "testnet",
  privateKey: privateKeyFromString(fullAccessKey.secretKey),
  defaultSignerId: accountId,
});

await nearWithNewKey
  .transaction(accountId)
  .deleteKey(accountId, functionCallKey.publicKey.toString())
  .send();
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/keys.js#L46-L55)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-api-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 60
end: 69
fname: keys.rs
language: rust
*/}

```rust title="keys.rs" lines
    // Delete full access key
    let public_key_to_delete = new_full_public_key;
    let delete_full_key_result = account
        .delete_key(public_key_to_delete.parse::<near_api::PublicKey>().unwrap())
        .with_signer(signer.clone())
        .send_to(&network)
        .await
        .unwrap();
    println!("{:?}", delete_full_key_result);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs/examples/keys.rs#L60-L69)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/keys.rs
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 45
end: 57
*/}

```rust title="keys.rs" lines
// Use the new Full Access Key to delete the Function Call Key
let near_with_new_key = near.with_signer(InMemorySigner::from_secret_key(
    account_id.as_str(),
    full_access_key.clone(),
)?);
near_with_new_key
    .delete_key(function_call_key.public_key())
    .send()
    .await?;
println!(
    "Deleted Function Call Key: {}",
    function_call_key.public_key()
);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/examples/keys.rs#L45-L57)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/keys.py
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
start: 47
end: 50
*/}

```python title="keys.py" lines
# Use the new Full Access Key to delete the Function Call Key
client_with_new_key = client.with_signer(KeyPairSigner(account_id, full_access_key))
client_with_new_key.send_transaction(account_id, actions=[delete_key(function_call_key.public_key)])
print(f"Deleted Function Call Key: {function_call_key.public_key}")
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/examples/keys.py#L47-L50)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

<Danger>
Be very careful when deleting keys. Removing all keys from an account will cause you to lose access to the account permanently.
</Danger>

### Post-Quantum Keys (ML-DSA-65)

NEAR supports the post-quantum [`ml-dsa-65`](/protocol/accounts-contracts/access-keys#signature-schemes) signature scheme (FIPS 204). You add and use an `ml-dsa-65` key exactly like an `ed25519` one — it can be a [full-access](/protocol/accounts-contracts/access-keys#full-access-keys) or [function-call](/protocol/accounts-contracts/access-keys#function-call-keys) key and signs transactions the same way.

Run these examples from their respective package directories using the shared `.env` configuration in the [example repository](https://github.com/near-examples/near-api-examples/tree/59b39409b26453c2b63d15f0875d88f9184e506d). Each registers a temporary post-quantum key, signs a testnet self-transfer, and removes the key afterward. Running them submits transactions and pays testnet gas fees.

<Tabs>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/post-quantum-keys.js
commit: 59b39409b26453c2b63d15f0875d88f9184e506d
start: 1
end: 38
fname: post-quantum-keys.js
language: javascript
*/}

```javascript title="post-quantum-keys.js" lines
import { MlDsa65KeyPair, Near } from "near-kit";
import dotenv from "dotenv";
import { privateKeyFromString } from "./helpers/private-key.js";

// Use an existing testnet account and its full-access key.
dotenv.config({ path: "../.env" });
const accountId = process.env.ACCOUNT_ID;
if (!accountId) throw new Error("ACCOUNT_ID is required");
const near = new Near({
  network: "testnet",
  privateKey: privateKeyFromString(process.env.PRIVATE_KEY),
  defaultSignerId: accountId,
});

// Generate an ML-DSA-65 key and register it using the existing signer.
const pqKey = MlDsa65KeyPair.fromRandom();
const publicKey = pqKey.publicKey.toString();
await near
  .transaction(accountId)
  .addKey(publicKey, { type: "fullAccess" })
  .send({ waitUntil: "FINAL" });
console.log("Added post-quantum key:", publicKey);

try {
  const pqNear = new Near({
    network: "testnet",
    privateKey: privateKeyFromString(pqKey.secretKey),
    defaultSignerId: accountId,
  });

  // Sign a self-transfer with the post-quantum key. This transaction pays gas.
  await pqNear.transaction(accountId).transfer(accountId, "0.001 NEAR").send();
  console.log("Post-quantum self-transfer completed");
} finally {
  // Remove the temporary key using the original signer.
  await near.transaction(accountId).deleteKey(accountId, publicKey).send();
  console.log("Removed post-quantum key:", publicKey);
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/59b39409b26453c2b63d15f0875d88f9184e506d/near-kit/examples/post-quantum-keys.js#L1-L38)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/post_quantum_keys.rs
commit: 59b39409b26453c2b63d15f0875d88f9184e506d
start: 1
end: 42
fname: post_quantum_keys.rs
language: rust
*/}

```rust title="post_quantum_keys.rs" lines
use near_kit::signer::{InMemorySigner, SecretKey};
use near_kit::transaction::Final;
use near_kit::{Error, Near, NearToken};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Use an existing testnet account and its full-access key.
    dotenvy::from_filename("../.env").ok();
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY");
    let account_id = std::env::var("ACCOUNT_ID").expect("ACCOUNT_ID");
    let near = Near::testnet()
        .credentials(&private_key, &account_id)?
        .build();

    // Generate an ML-DSA-65 key and register it using the existing signer.
    let pq_key = SecretKey::generate_ml_dsa65();
    let public_key = pq_key.public_key();
    near.add_full_access_key(public_key.clone())
        .send()
        .wait_until::<Final>()
        .await?;
    println!("Added post-quantum key: {public_key}");

    let pq_near = near.with_signer(InMemorySigner::from_secret_key(
        account_id.as_str(),
        pq_key,
    )?);
    // Sign a self-transfer with the post-quantum key. This transaction pays gas.
    let transfer_result = pq_near
        .transfer(account_id.as_str(), NearToken::from_millinear(1))
        .await;

    // Remove the temporary key using the original signer, even if the transfer failed.
    near.delete_key(public_key.clone())
        .send()
        .wait_until::<Final>()
        .await?;
    println!("Removed post-quantum key: {public_key}");
    transfer_result?;
    println!("Post-quantum self-transfer completed");
    Ok(())
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/59b39409b26453c2b63d15f0875d88f9184e506d/near-kit-rs/examples/post_quantum_keys.rs#L1-L42)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🐍 near-kit-py">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/post_quantum_keys.py
commit: 59b39409b26453c2b63d15f0875d88f9184e506d
start: 1
end: 32
fname: post_quantum_keys.py
language: python
*/}

```python title="post_quantum_keys.py" lines
import os

from dotenv import load_dotenv
from near import KeyPairSigner, MlDsa65KeyPair, Near, add_full_access_key, delete_key


def main() -> None:
    # Use an existing testnet account and its full-access key.
    load_dotenv("../.env")
    account_id = os.environ["ACCOUNT_ID"]
    client = Near(network="testnet", account_id=account_id, private_key=os.environ["PRIVATE_KEY"])

    # Generate an ML-DSA-65 key and register it using the existing signer.
    pq_key = MlDsa65KeyPair.generate()
    client.send_transaction(
        account_id, actions=[add_full_access_key(pq_key.public_key)], wait_until="FINAL"
    )
    print(f"Added post-quantum key: {pq_key.public_key}")

    try:
        pq_client = Near(network="testnet", signer=KeyPairSigner(account_id, pq_key))
        # Sign a self-transfer with the post-quantum key. This transaction pays gas.
        pq_client.send(account_id, "0.001 NEAR")
        print("Post-quantum self-transfer completed")
    finally:
        # Remove the temporary key using the original signer.
        client.send_transaction(account_id, actions=[delete_key(pq_key.public_key)])
        print(f"Removed post-quantum key: {pq_key.public_key}")


if __name__ == "__main__":
    main()
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/59b39409b26453c2b63d15f0875d88f9184e506d/near-kit-py/examples/post_quantum_keys.py#L1-L32)

</div>

{/* /github-code */}

  </Tab>
</Tabs>

<Note>
On-chain, an `ml-dsa-65` access key is stored as a 32-byte hash, so key listings such as [`view_access_key_list`](/api/rpc/contracts#view-access-key-list) return an `ml-dsa-65-hash:` handle instead of the full key — parse it with `parseMlDsa65Handle()` (near-kit) for display and comparison; the handle cannot sign or be re-added. Post-quantum keys are currently supported by [`near-kit`](https://github.com/r-near/near-kit) (TypeScript), [`near-kit-rs`](https://github.com/r-near/near-kit-rs) (Rust) and [`near-kit-py`](https://github.com/r-near/near-kit-py) (Python); support in `near-api-js` is pending.
</Note>

---

## Validate Message Signatures

Connected wallets can sign NEP-413 messages with `signMessage`. Use [NEAR Connect](/web3-apps/tutorials/wallet-login) to connect the wallet, then verify its signature with the following code:

<Tabs>
  <Tab title="🌐 near-api-js">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-api-js/examples/verify-signature.ts
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
fname: authenticate.ts
language: javascript
*/}

```javascript title="authenticate.ts" lines
import { verifyMessage } from "near-api-js/nep413";
import { JsonRpcProvider } from "near-api-js";

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com",
});

// This is the challenge given to the user to sign
const MESSAGE: string = "log me in";
const APP: string = "http://localhost:3000";
const CHALLENGE: Buffer = Buffer.from(Array.from(Array(32).keys()));

// This is the object returned by `wallet.signMessage` in wallet selector
const walletReturn = {
  "signature": "IfModLa3g3czlyPhkg/LSkTFSy7XCGreStZJTDIO1m3viEnYFLdXfpz1gYUVKYv3W2vwcV77TmGEzc9y0Nz+AA==",
  "accountId": "maguila.testnet",
  "publicKey": "ed25519:AtH7GEjv2qmBVoT8qoRhWXizXM5CC12DC6tiqY9iNoRm"
};

await verifyMessage({
  signerAccountId: walletReturn.accountId,
  signerPublicKey: walletReturn.publicKey,
  signature: new Uint8Array(Buffer.from(walletReturn.signature, 'base64')),
  payload: {
    message: MESSAGE,
    recipient: APP,
    nonce: CHALLENGE
  },
  provider
});
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-js/examples/verify-signature.ts)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🌐 near-kit">

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit/examples/verify-signature.js
commit: fe8a9b52688965ef272fc2e199fcd46111ff3ade
fname: authenticate.js
language: javascript
*/}

```javascript title="authenticate.js" lines
import { Near, verifyNep413Signature } from "near-kit";

// Create Near client for testnet (no signing needed for verification)
const near = new Near({ network: "testnet" });

// The challenge given to the user to sign
const MESSAGE = "log me in";
const APP = "http://localhost:3000";
const CHALLENGE = Buffer.from(Array.from(Array(32).keys()));

// The object returned by wallet.signMessage in wallet selector
const signedMessage = {
  signature:
    "IfModLa3g3czlyPhkg/LSkTFSy7XCGreStZJTDIO1m3viEnYFLdXfpz1gYUVKYv3W2vwcV77TmGEzc9y0Nz+AA==",
  accountId: "maguila.testnet",
  publicKey: "ed25519:AtH7GEjv2qmBVoT8qoRhWXizXM5CC12DC6tiqY9iNoRm",
};

// Verify the signature
const isValid = await verifyNep413Signature(
  signedMessage,
  {
    message: MESSAGE,
    recipient: APP,
    nonce: CHALLENGE,
  },
  { near, maxAge: Infinity }, // Disable timestamp check for this demo
);

console.log("Signature valid:", isValid);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit/examples/verify-signature.js)

</div>

{/* /github-code */}

  </Tab>
  <Tab title="🦀 near-kit-rs">

  Use the original challenge stored by your application. Generate its nonce with `near_kit::standards::nep413::generate_nonce()` so the default timestamp-expiry check applies, and reject reused challenges.

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-rs/examples/verify_signature.rs
commit: 2d7d8b3c365bf9f3118df9c9b0dbeab7c825c05a
start: 1
end: 14
fname: verify_signature.rs
language: rust
*/}

```rust title="verify_signature.rs" lines
use near_kit::{
    standards::nep413::{self, SignMessageParams, SignedMessage},
    Error, Near,
};

// Verify the original challenge stored by the application, not client-supplied parameters.
async fn verify_wallet_message(
    signed: &SignedMessage,
    challenge: &SignMessageParams,
) -> Result<bool, Error> {
    let near = Near::testnet().build();
    // Checks the signature, timestamp-nonce expiry, account ownership, and FullAccess permission.
    nep413::verify(signed, challenge, &near, Default::default()).await
}
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/2d7d8b3c365bf9f3118df9c9b0dbeab7c825c05a/near-kit-rs/examples/verify_signature.rs#L1-L14)

</div>

{/* /github-code */}

  [`nep413::verify`](https://docs.rs/near-kit/0.19.0/near_kit/types/nep413/fn.verify.html) checks the signature, nonce expiry, and that the signing key is a full-access key on the claimed account.

  </Tab>
  <Tab title="🐍 near-kit-py">

  Use the original message, recipient, and nonce stored by your application. Generate the nonce with `near.generate_nonce()` so the default timestamp-expiry check applies, and reject reused challenges.

{/* github-code
url: https://github.com/near-examples/near-api-examples/blob/main/near-kit-py/examples/verify_signature.py
commit: 2d7d8b3c365bf9f3118df9c9b0dbeab7c825c05a
start: 4
end: 20
fname: verify_signature.py
language: python
*/}

```python title="verify_signature.py" lines
from near import AccessKeyNotFoundError, Near, SignedMessage, generate_nonce, verify_message


# Verify the original challenge stored by the application, not client-supplied parameters.
def verify_wallet_message(
    signed: SignedMessage, message: str, recipient: str, nonce: bytes
) -> bool:
    if not verify_message(signed, message, recipient, nonce):
        return False

    # Signature verification alone does not prove account ownership.
    client = Near(network="testnet")
    try:
        key = client.access_key(signed.account_id, signed.public_key)
    except AccessKeyNotFoundError:
        return False
    return key.permission == "FullAccess"
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/near-api-examples/blob/2d7d8b3c365bf9f3118df9c9b0dbeab7c825c05a/near-kit-py/examples/verify_signature.py#L4-L20)

</div>

{/* /github-code */}

  [`verify_message`](https://github.com/r-near/near-kit-py/blob/main/src/near/nep413.py) checks the signature and nonce expiry. The additional RPC query verifies that the signing key is a full-access key on the claimed account.

  </Tab>
</Tabs>

---

## Additional resources

<Tabs>
  <Tab title="🌐 near-api-js">

  - [Documentation](https://near.github.io/near-api-js)
  - [Github](https://github.com/near/near-api-js)
  - [Full Examples](https://github.com/near-examples/near-api-examples/tree/main)

  </Tab>
  <Tab title="🌐 near-kit">

  - [Github](https://github.com/r-near/near-kit/tree/main)
  - [Full Examples](https://github.com/near-examples/near-api-examples/blob/main/near-kit)

  </Tab>
  <Tab title="🦀 near-api-rs">

  - [Documentation](https://docs.rs/near-api/latest/near_api/)
  - [Github](https://github.com/near/near-api-rs)
  - [Full Examples](https://github.com/near-examples/near-api-examples/tree/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-api-rs)

  </Tab>
  <Tab title="🦀 near-kit-rs">

  - [Complete Rust examples](https://github.com/near-examples/near-api-examples/tree/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs)
  - [Dependency configuration](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-rs/Cargo.toml)

  </Tab>
  <Tab title="🐍 near-kit-py">

  - [Complete Python examples](https://github.com/near-examples/near-api-examples/tree/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py)
  - [Dependency configuration](https://github.com/near-examples/near-api-examples/blob/fe8a9b52688965ef272fc2e199fcd46111ff3ade/near-kit-py/pyproject.toml)

  </Tab>
</Tabs>

`````

## web3-apps/tutorials/wallet-login.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/web3-apps/tutorials/wallet-login.mdx

`````markdown
---
title: Wallet Login
icon: wallet
description: "Enable users to login with their NEAR wallet"
---

The `@hot-labs/near-connect` library provides a secure, zero-dependency wallet connector for NEAR blockchain with a unique sandbox-based architecture.

<Warning>

**Do not use NEAR Wallet Selector (`@near-wallet-selector/*`).** It is deprecated and no longer maintained. Use NEAR Connect (`@hot-labs/near-connect`) to integrate wallets in new and existing apps.

</Warning>

![Preview](https://github.com/user-attachments/assets/c4422057-38bb-4cd9-8bd0-568e29f46280)

<Tip>

**Example**

We have a [working example](https://github.com/near-examples/hello-near-examples/tree/main/frontend), which you can easily get through `create-near-app`:

```bash
npx create-near-app@latest
```

</Tip>

---

## Why NEAR Connect?

Unlike traditional wallet selectors, it offers a dynamic manifest system that allows wallets to be added and updated without requiring developers to update their dependencies.

- **Secure Execution**: Wallet scripts run in isolated sandboxed iframes for maximum security
- **Dynamic Wallets**: Wallets are loaded from a manifest and can be updated without code changes
- **Zero Dependencies**: Lightweight library with no external dependencies
- **Automatic Detection**: Supports both injected wallets (extensions) and manifest-based wallets

---

## Installation

Install the `@hot-labs/near-connect` and `near-api-js` packages:

```bash
npm install @hot-labs/near-connect near-api-js
```

---

## Initializing the Connector

Initialize the `NearConnector` instance in your application:

```tsx
import { NearConnector } from "@hot-labs/near-connect";

const connector = new NearConnector({ network: "testnet" });
```

For React apps, we recommend [wrapping the connector, wallet state, and contract helpers in a React Context provider](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx), then exposing them through a local hook. This lets components share one connector instance and keeps connection handling in one place.

[Wrap your app with the provider](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/pages/_app.tsx) so all components can access the wallet functionality.

<Accordion title="Selecting Wallets">

Unlike traditional wallet selectors that bundle wallet code, NEAR Connect uses a **manifest-based approach**:

1. Wallet providers register their integration scripts in a public manifest
2. The connector dynamically loads wallet scripts when users want to connect

This architecture eliminates the need to install individual wallet packages and ensures wallet code can be updated independently from your app.

```tsx
const connector = new NearConnector({
  network: "testnet", // or "mainnet"
  features: {
    signMessage: true,  // Only show wallets that support message signing
    signTransaction: true,
    signInWithoutAddKey: true,
    signAndSendTransaction: true,
    signAndSendTransactions: true
  },
});
```

</Accordion>

---

## Signing In / Out

Subscribe to the `wallet:signIn` and `wallet:signOut` events to update your application's wallet state:

{/* github-code
url: https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx
commit: 8420b0ea2bc312c401ee79c2066d1bb8e57ee4e6
start: 95
end: 109
language: tsx
*/}

```tsx title="near-provider.tsx" lines
const handleSignIn = (payload: EventMap['wallet:signIn']) => {
  if (!cancelled) {
    setWallet(payload.wallet);
    setSignedAccountId(payload.accounts[0]?.accountId ?? '');
  }
};
const handleSignOut = () => {
  if (!cancelled) {
    setWallet(undefined);
    setSignedAccountId('');
  }
};

connector.on('wallet:signIn', handleSignIn);
connector.on('wallet:signOut', handleSignOut);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/hello-near-examples/blob/8420b0ea2bc312c401ee79c2066d1bb8e57ee4e6/frontend/src/providers/near-provider.tsx#L95-L109)

</div>

{/* /github-code */}

Call `connector.connect()` to open the wallet selection modal and `connector.disconnect(wallet)` to sign out. In the React provider, these calls also update the local wallet and account state:

{/* github-code
url: https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx
commit: 8420b0ea2bc312c401ee79c2066d1bb8e57ee4e6
start: 132
end: 144
language: tsx
*/}

```tsx title="near-provider.tsx" lines
const signIn = useCallback(async () => {
  const connectedWallet = await connector.connect();
  setWallet(connectedWallet);
  const accounts = await connectedWallet.getAccounts();
  setSignedAccountId(accounts[0]?.accountId ?? '');
}, [connector]);

const signOut = useCallback(async () => {
  if (!wallet) return;
  await connector.disconnect(wallet);
  setWallet(undefined);
  setSignedAccountId('');
}, [connector, wallet]);
```

<div className="github-source-link">

[See code on GitHub](https://github.com/near-examples/hello-near-examples/blob/8420b0ea2bc312c401ee79c2066d1bb8e57ee4e6/frontend/src/providers/near-provider.tsx#L132-L144)

</div>

{/* /github-code */}

[Restore an existing wallet connection](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx#L88-L92) during initialization and [remove event listeners](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx#L115-L129) when the component unmounts.

---

## Calling Contract Method

To call a contract method, first get the connected wallet instance using `connector.wallet()`, then use the wallet's `signAndSendTransaction` method to make a function call:

```tsx
// Get the connected wallet
const wallet = await connector.wallet();

// Call a change method
const result = await wallet.signAndSendTransaction({
  receiverId: "hello.near-examples.testnet",
  actions: [
    {
      type: "FunctionCall",
      params: {
        methodName: "set_greeting",
        args: { greeting: "Hello from NEAR Connect!" },
        gas: "30000000000000", // 30 TGas
        deposit: "0", // No deposit
      },
    },
  ],
});

console.log("Transaction:", result.transaction.hash);
```

---

## Calling Read-only Methods

NEAR Connect does not provide a built-in way to call read-only (view) methods.

However, you can use the `near-api-js` package (or any of your preferred APIs) to create a JSON-RPC provider and call view methods directly:

```tsx
import { JsonRpcProvider } from "near-api-js";

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

const greeting = await provider.callFunction({
  contractId: "hello.near-examples.testnet",
  method: "get_greeting",
  args: {},
});
```

---

## Get Balance

NEAR Connect does not provide a built-in way to get the account balance.

However, you can use the `near-api-js` package (or any of your preferred APIs) to create a JSON-RPC provider and query the account balance directly:

```tsx
import { JsonRpcProvider } from "near-api-js";

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

const account = await provider.viewAccount({ accountId: "hello.near-examples.testnet" });
```

---

## Send Multiple Transactions

You can request the user to sign and send multiple transactions in parallel through a single prompt:

```tsx
const wallet = await connector.wallet();

const results = await wallet.signAndSendTransactions({
  transactions: [
    {
      receiverId: "token.near",
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer",
            args: {
              receiver_id: "alice.near",
              amount: "1000000",
            },
            gas: "30000000000000",
            deposit: "1", // 1 yoctoNEAR for security
          },
        },
      ],
    },
    {
      receiverId: "nft.near",
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "nft_mint",
            args: {
              token_id: "token-1",
              receiver_id: "alice.near",
            },
            gas: "30000000000000",
            deposit: "10000000000000000000000", // 0.01 NEAR
          },
        },
      ],
    },
  ],
});

console.log(`Completed ${results.length} transactions`);
```

---

## Sign Messages (NEP-413)

In NEAR, users can sign messages for authentication purposes without needing to send a transaction on-chain:


```tsx
const wallet = await connector.wallet();

const signature = await wallet.signMessage({
  message: "Please sign this message to authenticate",
  recipient: "your-app.near",
  nonce: Buffer.from(crypto.randomUUID()),
});

console.log("Signature:", signature.signature);
console.log("Public Key:", signature.publicKey);

// Verify the signature on your backend
```

---

## Function-call keys at login

To request a [function-call access key](/protocol/accounts-contracts/access-keys#function-call-keys) during login, use [`function-call-key-plugin`](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx#L54-L66). After the user approves the key, the app can sign permitted contract calls locally without opening the wallet for each transaction.

Install the plugin alongside NEAR Connect and `near-api-js`:

```bash
npm install function-call-key-plugin
```

Create the plugin and register it with your connector before calling `connect()`:

```tsx
import { createAccessKeyPlugin } from "function-call-key-plugin";
import { nearToYocto } from "near-api-js";

const accessKeyPlugin = createAccessKeyPlugin({
  network: connector.network,
  providers: connector.providers,
  signIn: {
    contractId: "hello.near-examples.testnet",
    methodNames: ["set_greeting"],
    allowance: nearToYocto("0.25").toString(),
  },
});

await connector.use(accessKeyPlugin);

// Call this when the user clicks the login button.
const wallet = await connector.connect();
```

This configuration permits calls to `set_greeting` on `hello.near-examples.testnet`, with zero attached deposit and a gas allowance of 0.25 NEAR. The allowance limits how much the key can spend on gas; the account still pays transaction fees from its balance.

The plugin generates the key pair during sign-in and stores the private key locally after sign-in succeeds. Continue calling `wallet.signAndSendTransaction()` as shown in [Calling Contract Method](#calling-contract-method): the plugin signs eligible calls with the local key and sends calls outside its permissions to the wallet for approval. It also falls back to the wallet if the key's allowance runs out or the key has been removed on-chain.

In React, [create the plugin once](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx#L54-L66) and [await its registration during initialization](https://github.com/near-examples/hello-near-examples/blob/main/frontend/src/providers/near-provider.tsx#L79-L86).

`````

## integrations/fungible-tokens.mdx

Source: https://raw.githubusercontent.com/near/docs/7be61a444184e5c11e66363a459f36e6f116f426/integrations/fungible-tokens.mdx

`````markdown
---
id: fungible-tokens
title: Fungible tokens
sidebarTitle: Fungible Tokens
description: "Integrate NEP-141 fungible tokens, including balance queries, storage registration, transfers, and metadata."
---

Fungible tokens on NEAR follow the [NEP-141 standard](https://github.com/near/NEPs/blob/master/neps/nep-0141.md). Each token is implemented as a smart contract that tracks account balances and exposes methods to query balances (`ft_balance_of`), transfer tokens (`ft_transfer`), and transfer tokens to another contract while calling its `ft_on_transfer` method (`ft_transfer_call`).

<Note>

Please see the [spec for the fungible token standard](https://github.com/near/NEPs/tree/master/neps/nep-0141.md) and an [example implementation](https://github.com/near-examples/FT) for reference details.

</Note>
---

## Token metadata {#get-info-about-the-ft}

The [`ft_metadata` method](https://github.com/near/NEPs/blob/master/neps/nep-0148.md) returns the token's name, symbol, decimals, and optional display information such as its icon.

<Tabs>
<Tab title="NEAR CLI">

```bash
near contract call-function as-read-only meta-pool.near ft_metadata json-args '{}' network-config mainnet now

# Selected result fields:
# {
#   "spec": "ft-1.0.0",
#   "name": "Staked NEAR",
#   "symbol": "STNEAR",
#   "decimals": 24
# }
```

</Tab>
<Tab title="RPC">

```bash
http post https://rpc.mainnet.near.org jsonrpc=2.0 id=ftmetadata method=query \
  params:='{"request_type":"call_function","finality":"final","account_id":"meta-pool.near","method_name":"ft_metadata","args_base64":"e30="}'
```

<Accordion title="Metadata RPC response">

```json
{
  "jsonrpc": "2.0",
  "result": {
    "block_hash": "8cwU7ukBxmzFqejV9U75MiRmw4RENnweqT8egx2Tz2s3",
    "block_height": 219151015,
    "logs": [],
    "result": [123, 34, 115, 112, 101, 99, 34, 58, 34, 102, 116, 45, 49, 46, 48, 46, 48, 34, 44, 34, 110, 97, 109, 101, 34, 58, 34, 83, 116, 97, 107, 101, 100, 32, 78, 69, 65, 82, 34, 44, 34, 115, 121, 109, 98, 111, 108, 34, 58, 34, 83, 84, 78, 69, 65, 82, 34, 44, 34, 105, 99, 111, 110, 34, 58, 34, 100, 97, 116, 97, 58, 105, 109, 97, 103, 101, 47, 115, 118, 103, 43, 120, 109, 108, 44, 37, 51, 99, 115, 118, 103, 32, 119, 105, 100, 116, 104, 61, 39, 57, 54, 39, 32, 104, 101, 105, 103, 104, 116, 61, 39, 57, 54, 39, 32, 118, 105, 101, 119, 66, 111, 120, 61, 39, 48, 32, 48, 32, 57, 54, 32, 57, 54, 39, 32, 102, 105, 108, 108, 61, 39, 110, 111, 110, 101, 39, 32, 120, 109, 108, 110, 115, 61, 39, 104, 116, 116, 112, 58, 47, 47, 119, 119, 119, 46, 119, 51, 46, 111, 114, 103, 47, 50, 48, 48, 48, 47, 115, 118, 103, 39, 37, 51, 101, 37, 51, 99, 114, 101, 99, 116, 32, 119, 105, 100, 116, 104, 61, 39, 57, 54, 39, 32, 104, 101, 105, 103, 104, 116, 61, 39, 57, 54, 39, 32, 114, 120, 61, 39, 52, 56, 39, 32, 102, 105, 108, 108, 61, 39, 119, 104, 105, 116, 101, 39, 47, 37, 51, 101, 37, 51, 99, 112, 97, 116, 104, 32, 102, 105, 108, 108, 45, 114, 117, 108, 101, 61, 39, 101, 118, 101, 110, 111, 100, 100, 39, 32, 99, 108, 105, 112, 45, 114, 117, 108, 101, 61, 39, 101, 118, 101, 110, 111, 100, 100, 39, 32, 100, 61, 39, 77, 52, 56, 46, 48, 48, 48, 54, 32, 50, 48, 76, 52, 49, 46, 50, 53, 55, 53, 32, 50, 54, 46, 55, 52, 51, 49, 76, 52, 56, 46, 48, 48, 48, 54, 32, 51, 51, 46, 52, 56, 54, 50, 76, 53, 52, 46, 55, 52, 51, 55, 32, 50, 54, 46, 55, 52, 51, 49, 76, 52, 56, 46, 48, 48, 48, 54, 32, 50, 48, 90, 77, 51, 55, 46, 50, 56, 49, 32, 51, 48, 46, 55, 49, 56, 56, 76, 51, 48, 46, 55, 49, 52, 52, 32, 51, 55, 46, 50, 56, 53, 51, 76, 52, 55, 46, 57, 57, 57, 56, 32, 53, 52, 46, 53, 55, 48, 55, 76, 54, 53, 46, 50, 56, 53, 49, 32, 51, 55, 46, 50, 56, 53, 51, 76, 53, 56, 46, 55, 49, 56, 54, 32, 51, 48, 46, 55, 49, 56, 56, 76, 52, 55, 46, 57, 57, 57, 56, 32, 52, 49, 46, 52, 51, 55, 54, 76, 51, 55, 46, 50, 56, 49, 32, 51, 48, 46, 55, 49, 56, 56, 90, 77, 50, 54, 46, 55, 51, 56, 52, 32, 52, 49, 46, 50, 54, 49, 76, 49, 57, 46, 57, 57, 53, 51, 32, 52, 56, 46, 48, 48, 52, 49, 76, 52, 55, 46, 57, 57, 57, 53, 32, 55, 54, 46, 48, 48, 56, 51, 76, 55, 54, 46, 48, 48, 51, 55, 32, 52, 56, 46, 48, 48, 52, 49, 76, 54, 57, 46, 50, 54, 48, 54, 32, 52, 49, 46, 50, 54, 49, 49, 76, 52, 55, 46, 57, 57, 57, 53, 32, 54, 50, 46, 53, 50, 50, 49, 76, 50, 54, 46, 55, 51, 56, 52, 32, 52, 49, 46, 50, 54, 49, 90, 39, 32, 102, 105, 108, 108, 61, 39, 37, 50, 51, 50, 51, 49, 66, 53, 49, 39, 47, 37, 51, 101, 37, 51, 99, 47, 115, 118, 103, 37, 51, 101, 34, 44, 34, 114, 101, 102, 101, 114, 101, 110, 99, 101, 34, 58, 34, 104, 116, 116, 112, 115, 58, 47, 47, 109, 101, 116, 97, 112, 111, 111, 108, 46, 97, 112, 112, 34, 44, 34, 114, 101, 102, 101, 114, 101, 110, 99, 101, 95, 104, 97, 115, 104, 34, 58, 110, 117, 108, 108, 44, 34, 100, 101, 99, 105, 109, 97, 108, 115, 34, 58, 50, 52, 125]
  },
  "id": "ftmetadata"
}
```

</Accordion>

[Decoded result](/api/rpc/contracts#decode-the-result) (selected fields):

```json
{
  "spec": "ft-1.0.0",
  "name": "Staked NEAR",
  "symbol": "STNEAR",
  "decimals": 24
}
```

</Tab>
</Tabs>

### Decimals
`decimals` determines how to display the integer amounts in which the token is denominated.

For a token with `decimals: 6`, `"1000000"` raw units represents 1 token, and `"1500000"` represents 1.5 tokens. `meta-pool.near` uses 24 decimals, so `"1000000000000000000000000"` raw units represents 1 STNEAR.

<Info>
Use the token's metadata when converting amounts, but keep raw balances and transfer arguments as integer strings.
</Info>

---

## Get balance {#get-balance}

Call `ft_balance_of` with the account ID to get its raw token balance.

<Tabs>
<Tab title="NEAR CLI">

```bash
near contract call-function as-read-only meta-pool.near ft_balance_of json-args '{"account_id": "root.near"}' network-config mainnet now

# Returns:
# "1387952532024477011546901"
```

</Tab>
<Tab title="RPC">

You can [call a contract function](/api/rpc/contracts#call-a-contract-function) using the `query` RPC endpoint. Below is an example using HTTPie:

```bash
http post https://rpc.mainnet.near.org jsonrpc=2.0 id=ftbalance method=query \
params:='{
  "request_type": "call_function",
  "finality": "final",
  "account_id": "meta-pool.near",
  "method_name": "ft_balance_of",
  "args_base64": "eyJhY2NvdW50X2lkIjoicm9vdC5uZWFyIn0="
}'
```

Returns:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "block_hash": "8cwU7ukBxmzFqejV9U75MiRmw4RENnweqT8egx2Tz2s3",
    "block_height": 219151015,
    "logs": [],
    "result": [34, 49, 51, 56, 55, 57, 53, 50, 53, 51, 50, 48, 50, 52, 52, 55, 55, 48, 49, 49, 53, 52, 54, 57, 48, 49, 34]
  },
  "id": "ftbalance"
}
```

[Decoded result](/api/rpc/contracts#decode-the-result):

```json
"1387952532024477011546901"
```

</Tab>
</Tabs>

NEP-141 returns balances as base-10 integer strings to preserve amounts larger than JavaScript's safe integer limit (`2^53 - 1`). Decode the JSON string and use integer arithmetic for balances and transfers.

---

## Simple transfer {#simple-transfer}

Before calling `ft_transfer`, register the receiver with the token contract so the contract can store its balance.

### Storage registration

Check `storage_balance_of` for the receiver. A `null` result means it is unregistered; query `storage_balance_bounds` and attach its `min` amount in yoctoNEAR when calling `storage_deposit`. The queries below show that `root.near` is already registered with `meta-pool.near`, whose minimum is `0.00125 NEAR`.

<Tabs>
<Tab title="NEAR CLI">

```bash
near contract call-function as-read-only meta-pool.near storage_balance_of json-args '{"account_id":"root.near"}' network-config mainnet now
# Result: {"total":"1250000000000000000000","available":"0"}

near contract call-function as-read-only meta-pool.near storage_balance_bounds json-args '{}' network-config mainnet now
# Result: {"min":"1250000000000000000000","max":"1250000000000000000000"}

```

For an unregistered receiver, deposit the returned minimum:

```bash
near contract call-function as-transaction meta-pool.near storage_deposit json-args '{"account_id":"<receiver_account_id>","registration_only":true}' prepaid-gas '30 Tgas' attached-deposit '0.00125 NEAR' sign-as <sender_account_id> network-config mainnet sign-with-keychain send
```

</Tab>
<Tab title="RPC">

```bash
http post https://rpc.mainnet.near.org jsonrpc=2.0 id=storagebalanceof method=query \
  params:='{"request_type":"call_function","finality":"final","account_id":"meta-pool.near","method_name":"storage_balance_of","args_base64":"eyJhY2NvdW50X2lkIjoicm9vdC5uZWFyIn0="}'

http post https://rpc.mainnet.near.org jsonrpc=2.0 id=storagebalancebounds method=query \
  params:='{"request_type":"call_function","finality":"final","account_id":"meta-pool.near","method_name":"storage_balance_bounds","args_base64":"e30="}'
```

[Decoded results](/api/rpc/contracts#decode-the-result), respectively:

```json
{"total":"1250000000000000000000","available":"0"}
```

```json
{"min":"1250000000000000000000","max":"1250000000000000000000"}
```

To register an unregistered receiver, [create and sign a transaction](/integrations/create-transactions#low-level-create-a-transaction) addressed to `meta-pool.near` with a `FunctionCall` action: `method_name: "storage_deposit"`, JSON arguments `{"account_id":"<receiver_account_id>","registration_only":true}`, and `deposit: "1250000000000000000000"` yoctoNEAR. Submit the signed payload with [`send_tx`](/api/rpc/transactions#send-transaction) and `wait_until: "FINAL"`.

</Tab>
</Tabs>

### Transfer tokens

Call `ft_transfer` with the receiver's account ID and an integer-string amount in the token's smallest unit. Attach exactly **1 yoctoNEAR**. With STNEAR's 24 decimals, the amount below transfers 1 STNEAR to `root.near`.

<Tabs>
<Tab title="NEAR CLI">

```bash
near contract call-function as-transaction meta-pool.near ft_transfer json-args '{"receiver_id":"root.near","amount":"1000000000000000000000000"}' prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as <sender_account_id> network-config mainnet sign-with-keychain send
```

</Tab>
<Tab title="RPC">

[Create and sign a transaction](/integrations/create-transactions#low-level-create-a-transaction) addressed to `meta-pool.near` with a `FunctionCall` action: `method_name: "ft_transfer"`, JSON arguments `{"receiver_id":"root.near","amount":"1000000000000000000000000"}`, and `deposit: "1"` yoctoNEAR.

```bash
http post https://rpc.mainnet.near.org jsonrpc=2.0 id=transfer method=send_tx \
  params:='{"signed_tx_base64":"REPLACE_WITH_SIGNED_TRANSACTION_BASE64","wait_until":"FINAL"}'
```

A successful `ft_transfer` returns an empty `status.SuccessValue`; see [decoded transaction results](/api/rpc/contracts#transaction-return-values). Execution errors appear in `status.Failure`.

</Tab>
</Tabs>

Require `final_execution_status === "FINAL"` and a successful token-call receipt before confirming the transfer. An insufficient token balance or an unregistered receiver causes execution failure; inspect the error before retrying.

### Deposit accounting

For general deposit accounting, use an [indexer](/data-infrastructure/indexers) to inspect [NEP-300 events](https://github.com/near/NEPs/blob/master/neps/nep-0300.md) in successful finalized token-contract outcomes: `EVENT_JSON:` with `standard: "nep141"`, `version: "1.0.0"`, and `event: "ft_transfer"`.

Authenticate `executor_id` against the approved token contract; another contract can print the same log.

---

## Transfer and call {#transfer-and-call}

The `ft_transfer_call` method allows a user to transfer tokens to a contract while simultaneously triggering a function call on the receiving contract.

Let's call `ft_transfer_call` function on `ft` contract (receiver) and examine successful and unsuccessful scenarios.

### Successful transfer and call {#successful-transfer-and-call}
  Let's send 10 raw FT units to a `DEFI` contract that uses only 9. These are smallest-unit amounts, not NEAR or necessarily ten displayed tokens; apply the token's approved decimals for display.

<Tabs>
<Tab title="NEAR CLI">

```bash
near contract call-function as-transaction <ft_contract_id> ft_transfer_call json-args '{"receiver_id": "<defi_contract_id>", "amount": "10", "msg": "take-my-money"}' prepaid-gas '100.0 Tgas' attached-deposit '1 yoctoNEAR' sign-as <user_account_id> network-config testnet sign-with-keychain send
```

</Tab>
<Tab title="RPC">

Transaction representation:

```yaml
Transaction: {
	block_hash: `456…abc`,
	signer_id: "serhii.testnet",
	public_key: "ed25519:789…def",
	nonce: 123,
	receiver_id: "dev-1623333795623-21399959778159",
	actions: [
		FunctionCall(
			FunctionCallAction {
				method_name: ft_transfer_call,
				args: `{"receiver_id":"dev-1623693121955-71667632531176","amount":"10","msg":"take-my-money"}`,
				gas: 100000000000000,
				deposit: 1,
			},
		),
	]
}
```

```bash
  http post https://rpc.testnet.near.org jsonrpc=2.0 id=dontcare method=send_tx \
  params:='{"signed_tx_base64":"REPLACE_WITH_FRESH_SIGNED_TRANSACTION_BASE64","wait_until":"FINAL"}'
```

To get details of this transaction:

```bash
http post https://archival-rpc.testnet.near.org jsonrpc=2.0 method=EXPERIMENTAL_tx_status \
    params:='{"tx_hash":"5n1kwA3TQQyFTkddR2Jau3H1Pt8ebQNGaov6aCQ6TDp1","sender_account_id":"serhii.testnet","wait_until":"FINAL"}' id=myid
```

<details>

<summary>**Example Response:**</summary>

```json
{
  "jsonrpc": "2.0",
  "result": {
    "final_execution_status": "FINAL",
    "receipts": [
      {
        "predecessor_id": "serhii.testnet",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "FunctionCall": {
                  "args": "eyJyZWNlaXZlcl9pZCI6ImRldi0xNjIzNjkzMTIxOTU1LTcxNjY3NjMyNTMxMTc2IiwiYW1vdW50IjoiMTAiLCJtc2ciOiJ0YWtlLW15LW1vbmV5In0=",
                  "deposit": "1",
                  "gas": 100000000000000,
                  "method_name": "ft_transfer_call"
                }
              }
            ],
            "gas_price": "186029458",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "Hw6z8kJ7CSaC6SgyQzcmXzNX9gq1gaAnLS169qgyZ2Vk",
        "receiver_id": "dev-1623333795623-21399959778159"
      },
      {
        "predecessor_id": "dev-1623333795623-21399959778159",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "FunctionCall": {
                  "args": "eyJzZW5kZXJfaWQiOiJzZXJoaWkudGVzdG5ldCIsImFtb3VudCI6IjEwIiwibXNnIjoidGFrZS1teS1tb25leSJ9",
                  "deposit": "0",
                  "gas": 70000000000000,
                  "method_name": "ft_on_transfer"
                }
              }
            ],
            "gas_price": "186029458",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [
              {
                "data_id": "EiDQi54XHfdD1KEcgiNzogXxXuwTpzeQfmyqVwbq7H4D",
                "receiver_id": "dev-1623333795623-21399959778159"
              }
            ],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "EB69xtJiLRh9RNzAHgBGmom8551hrK2xSRreqbjvJgu5",
        "receiver_id": "dev-1623693121955-71667632531176"
      },
      {
        "predecessor_id": "system",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "Transfer": {
                  "deposit": "13116953530949529501760"
                }
              }
            ],
            "gas_price": "0",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "AkwgvxUspRgy255fef2hrEWMbrMWFtnTRGduSgDRdSW1",
        "receiver_id": "serhii.testnet"
      },
      {
        "predecessor_id": "dev-1623333795623-21399959778159",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "FunctionCall": {
                  "args": "eyJzZW5kZXJfaWQiOiJzZXJoaWkudGVzdG5ldCIsInJlY2VpdmVyX2lkIjoiZGV2LTE2MjM2OTMxMjE5NTUtNzE2Njc2MzI1MzExNzYiLCJhbW91bnQiOiIxMCJ9",
                  "deposit": "0",
                  "gas": 5000000000000,
                  "method_name": "ft_resolve_transfer"
                }
              }
            ],
            "gas_price": "186029458",
            "input_data_ids": [
              "EiDQi54XHfdD1KEcgiNzogXxXuwTpzeQfmyqVwbq7H4D"
            ],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "4Tc8MsrJZSMpNZx7u4jSqxr3WhRzqxaNHxLJFqz8tUPR",
        "receiver_id": "dev-1623333795623-21399959778159"
      },
      {
        "predecessor_id": "system",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "Transfer": {
                  "deposit": "761030677610514102464"
                }
              }
            ],
            "gas_price": "0",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "9rxcC9o8x4RX7ftsDCfxK8qnisYv45rA1HGPxhuukWUL",
        "receiver_id": "serhii.testnet"
      },
      {
        "predecessor_id": "system",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "Transfer": {
                  "deposit": "2137766093631769060520"
                }
              }
            ],
            "gas_price": "0",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "H7YWFkvx16Efy2keCQ7BQ67BMEsdgdYLqJ99G4H3dR1D",
        "receiver_id": "serhii.testnet"
      }
    ],
    "receipts_outcome": [
      {
        "block_hash": "B9yZz1w3yzrqQnfBFAf17S4TLaHakXJWqmFDBbFxaEiZ",
        "id": "Hw6z8kJ7CSaC6SgyQzcmXzNX9gq1gaAnLS169qgyZ2Vk",
        "outcome": {
          "executor_id": "dev-1623333795623-21399959778159",
          "gas_burnt": 20612680932083,
          "logs": [
            "Transfer 10 from serhii.testnet to dev-1623693121955-71667632531176"
          ],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [
            "EB69xtJiLRh9RNzAHgBGmom8551hrK2xSRreqbjvJgu5",
            "4Tc8MsrJZSMpNZx7u4jSqxr3WhRzqxaNHxLJFqz8tUPR",
            "H7YWFkvx16Efy2keCQ7BQ67BMEsdgdYLqJ99G4H3dR1D"
          ],
          "status": {
            "SuccessReceiptId": "4Tc8MsrJZSMpNZx7u4jSqxr3WhRzqxaNHxLJFqz8tUPR"
          },
          "tokens_burnt": "2061268093208300000000"
        },
        "proof": []
      },
      {
        "block_hash": "7Z4LHWksvw7sKYKwpQfjEMG8oigjtRXKa3EopN7hS2v7",
        "id": "EB69xtJiLRh9RNzAHgBGmom8551hrK2xSRreqbjvJgu5",
        "outcome": {
          "executor_id": "dev-1623693121955-71667632531176",
          "gas_burnt": 3568066327145,
          "logs": [
            "Sender @serhii.testnet is transfering 10 tokens using ft_on_transfer, msg = take-my-money"
          ],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [
            "AkwgvxUspRgy255fef2hrEWMbrMWFtnTRGduSgDRdSW1"
          ],
          "status": {
            "SuccessValue": "IjEi"
          },
          "tokens_burnt": "356806632714500000000"
        },
        "proof": [
          {
            "direction": "Right",
            "hash": "5X2agUKpqmk7QkUZsDQ4R4HdX7zXeuPYpVAfvbmF5Gav"
          }
        ]
      },
      {
        "block_hash": "CrSDhQNn72K2Qr1mmoM9j3YHCo3wfZdmHjpHJs74WnPk",
        "id": "AkwgvxUspRgy255fef2hrEWMbrMWFtnTRGduSgDRdSW1",
        "outcome": {
          "executor_id": "serhii.testnet",
          "gas_burnt": 0,
          "logs": [],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [],
          "status": {
            "SuccessValue": ""
          },
          "tokens_burnt": "0"
        },
        "proof": [
          {
            "direction": "Right",
            "hash": "4WG6hF5fTAtM7GSqU8mprrFwRVbChGMCV2NPZEjEdnc1"
          }
        ]
      },
      {
        "block_hash": "CrSDhQNn72K2Qr1mmoM9j3YHCo3wfZdmHjpHJs74WnPk",
        "id": "4Tc8MsrJZSMpNZx7u4jSqxr3WhRzqxaNHxLJFqz8tUPR",
        "outcome": {
          "executor_id": "dev-1623333795623-21399959778159",
          "gas_burnt": 6208280264404,
          "logs": [
            "Refund 1 from dev-1623693121955-71667632531176 to serhii.testnet"
          ],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [
            "9rxcC9o8x4RX7ftsDCfxK8qnisYv45rA1HGPxhuukWUL"
          ],
          "status": {
            "SuccessValue": "Ijki"
          },
          "tokens_burnt": "620828026440400000000"
        },
        "proof": [
          {
            "direction": "Left",
            "hash": "BzT8YhEDDWSuoGGTBzH2Cj5GC4c56uAQxk41by4KVnXi"
          }
        ]
      },
      {
        "block_hash": "3Q2Zyscj6vG5nC2vdoYfcBHU9RVaAwoxHsHzAKVcAHZ6",
        "id": "9rxcC9o8x4RX7ftsDCfxK8qnisYv45rA1HGPxhuukWUL",
        "outcome": {
          "executor_id": "serhii.testnet",
          "gas_burnt": 0,
          "logs": [],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [],
          "status": {
            "SuccessValue": ""
          },
          "tokens_burnt": "0"
        },
        "proof": []
      },
      {
        "block_hash": "7Z4LHWksvw7sKYKwpQfjEMG8oigjtRXKa3EopN7hS2v7",
        "id": "H7YWFkvx16Efy2keCQ7BQ67BMEsdgdYLqJ99G4H3dR1D",
        "outcome": {
          "executor_id": "serhii.testnet",
          "gas_burnt": 0,
          "logs": [],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [],
          "status": {
            "SuccessValue": ""
          },
          "tokens_burnt": "0"
        },
        "proof": [
          {
            "direction": "Left",
            "hash": "61ak42D3duBBunCz3w4xXxoEeR2N7oav5e938TnmGFGN"
          }
        ]
      }
    ],
    "status": {
      "SuccessValue": "Ijki"
    },
    "transaction": {
      "actions": [
        {
          "FunctionCall": {
            "args": "eyJyZWNlaXZlcl9pZCI6ImRldi0xNjIzNjkzMTIxOTU1LTcxNjY3NjMyNTMxMTc2IiwiYW1vdW50IjoiMTAiLCJtc2ciOiJ0YWtlLW15LW1vbmV5In0=",
            "deposit": "1",
            "gas": 100000000000000,
            "method_name": "ft_transfer_call"
          }
        }
      ],
      "hash": "5n1kwA3TQQyFTkddR2Jau3H1Pt8ebQNGaov6aCQ6TDp1",
      "nonce": 47589658000040,
      "priority_fee": 0,
      "public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN",
      "receiver_id": "dev-1623333795623-21399959778159",
      "signature": "ed25519:256qp2jAGXhhw2t2XfUAjWwzz3XcD83DH2v9THwDPsZjCLWHU8QJd6cuA773NP9yBmTd2ZyYiFHuxVEkYqnbsaSb",
      "signer_id": "serhii.testnet"
    },
    "transaction_outcome": {
      "block_hash": "96k8kKzFuZWxyiUnT774Rg7DC3XDZNuxhxD1qEViFupd",
      "id": "5n1kwA3TQQyFTkddR2Jau3H1Pt8ebQNGaov6aCQ6TDp1",
      "outcome": {
        "executor_id": "serhii.testnet",
        "gas_burnt": 2428149065268,
        "logs": [],
        "metadata": {
          "gas_profile": null,
          "version": 1
        },
        "receipt_ids": [
          "Hw6z8kJ7CSaC6SgyQzcmXzNX9gq1gaAnLS169qgyZ2Vk"
        ],
        "status": {
          "SuccessReceiptId": "Hw6z8kJ7CSaC6SgyQzcmXzNX9gq1gaAnLS169qgyZ2Vk"
        },
        "tokens_burnt": "242814906526800000000"
      },
      "proof": []
    }
  },
  "id": "myid"
}
```

</details>

For the [decoded result](/api/rpc/contracts#transaction-return-values), decode the successful `SuccessValue` as described in the RPC reference.

</Tab>
</Tabs>

Now, let's try to follow the steps described in the previous section and determine if these transactions was successful. In addition to being successful, let's analyze the various receipts in the series of cross-contract calls to determine how many fungible tokens were transferred. This will be the most complex case we'll look at.

  1. Check that `result` » `transaction_outcome` » `outcome` » `status` has `SuccessReceiptId` as a key. If not, this transaction-processing step did not produce the expected receipt; inspect the actual failure and all available outcomes.
  2. Take the value of the `SuccessReceiptId` key. In the case above it's `Hw6z8kJ7CSaC6SgyQzcmXzNX9gq1gaAnLS169qgyZ2Vk`.
  3. Now, under `result` » `receipts` loop through the array until you find a receipt where the `receipt_id` matches the value from step 2. (Note that in the receipt, under `Actions` there's an element mentioning calling the `method_name: "ft_transfer_call"`.) On the same level of JSON, there's an `args` key. That's a base64-encoded value of the arguments passed to the method. When decoded it is:

```json
{"receiver_id":"dev-1623693121955-71667632531176","amount":"10","msg":"take-my-money"}
```

  4. Loop through `result` » `receipts_outcome` until finding the object where `id` is equal to the value from step 2. Similar to step 1, this object will also contain a `status` field that should contain the key `SuccessReceiptId`. For this example, follow `SuccessReceiptId` to the resolver. In general, inspect success/failure and receipt dependencies rather than treating the absence of this particular key as proof that no tokens moved. In the above example, this value is `4Tc8MsrJZSMpNZx7u4jSqxr3WhRzqxaNHxLJFqz8tUPR`.
  5. Similar to the previous step, loop through the `result` » `receipts_outcome` until you find the object where the `id` matches the value from step 4. In that object check that `outcome` » `status` has the `SuccessValue` field. This resolver’s `SuccessValue` reports how many fungible-token units were used, not the unused amount returned by `ft_on_transfer`. Note that in the example above the value is `Ijki`, which is the base64-encoded version of `"9"`. In this example, 10 raw token units were sent (from step 3), 9 were used, and 1 was refunded.

For additional clarity, let's take a look at one more optional aspect. In step 4 we isolated an object in `result` » `receipts_outcome`. There's an array of `receipt_ids` that's particularly interesting. In this example, receipt `EB69xtJiLRh9RNzAHgBGmom8551hrK2xSRreqbjvJgu5` executes `ft_on_transfer`. Identify that role from the receipt’s executor and method, not its position in the array. If we loop through the `result` » `receipts_outcome` and find this as the value for the `id` key, we'll see what happened in the function `ft_on_transfer` which takes place in the contract receiving the fungible tokens. In this object the `status` » `SuccessValue` is `IjEi` which is the base64-encoded value of `"1"`.

In summary:
1. A user called the fungible token contract with the method `ft_transfer_call` specifying the receiver account, how many tokens to send, and custom info.
2. The receiver account implemented `ft_on_transfer`, returning `"1"` to the callback function on the fungible token contract.
3. The fungible token contract's callback is `ft_resolve_transfer` and receives this value of `"1"`. It attempts to refund the 1 unused unit, subject to the receiver’s remaining token balance, and subtracts the actual refund from the 10 initially transferred. It then returns to the user how many tokens were used in this back-and-forth series of cross-contract calls: `"9"`.

Wait for finalized resolver execution before releasing a transfer-and-call deposit. An initial transfer event can be followed by a refund event. For a conventional NEP-141 implementation:

| Callback result | Resolution when the full unused balance is refundable |
| --- | --- |
| `"0"` unused | 10 units used, no refund |
| `"1"` unused | 9 units used, 1 refunded |
| `"10"` unused | 0 used, 10 refunded |
| Callback `Failure` | Resolver attempts to refund all 10 |

A failed callback does not roll back the initial token receipt. The resolver can refund only the available balance; forwarded or spent tokens and account unregistration can change the result. Inspect finalized transfer/refund/burn effects and reconcile the final balance. Support this route only with a reviewed receiving-contract routing and callback policy.

### Failed transfer and call {#failed-transfer-and-call}
Let's try to send more tokens than the account has:

<Tabs>
<Tab title="NEAR CLI">

```bash
near contract call-function as-transaction <ft_contract_id> ft_transfer_call json-args '{"receiver_id": "<defi_contract_id>", "amount": "1000000000", "msg": "take-my-money"}' prepaid-gas '100.0 Tgas' attached-deposit '1 yoctoNEAR' sign-as <user_account_id> network-config testnet sign-with-keychain send
```

</Tab>
<Tab title="RPC">

Transaction representation:

```yaml
Transaction: {
	block_hash: `456…abc`,
	signer_id: "serhii.testnet",
	public_key: "ed25519:789…def",
	nonce: 123,
	receiver_id: "dev-1623333795623-21399959778159",
	actions: [
		FunctionCall(
			FunctionCallAction {
				method_name: ft_transfer_call,
				args: `{"receiver_id":"dev-1623333916368-58707434878533","amount":"1000000000","msg":"take-my-money"}`,
				gas: 100000000000000,
				deposit: 1,
			},
		),
	]
}
```



```bash
  http post https://rpc.testnet.near.org jsonrpc=2.0 id=dontcare method=send_tx \
  params:='{"signed_tx_base64":"REPLACE_WITH_FRESH_SIGNED_TRANSACTION_BASE64","wait_until":"FINAL"}'
```

To get details of this transaction:

```bash
http post https://archival-rpc.testnet.near.org jsonrpc=2.0 method=EXPERIMENTAL_tx_status \
    params:='{"tx_hash":"FQsh44pvEsK8RS9AbK868CmGwfhUU2pUrizkQ6wCWTsB","sender_account_id":"serhii.testnet","wait_until":"FINAL"}' id=myid
```

<details>

<summary>**Example response**:</summary>

```json
{
  "jsonrpc": "2.0",
  "result": {
    "final_execution_status": "FINAL",
    "receipts": [
      {
        "predecessor_id": "serhii.testnet",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "FunctionCall": {
                  "args": "eyJyZWNlaXZlcl9pZCI6ImRldi0xNjIzMzMzOTE2MzY4LTU4NzA3NDM0ODc4NTMzIiwiYW1vdW50IjoiMTAwMDAwMDAwMCIsIm1zZyI6InRha2UtbXktbW9uZXkifQ==",
                  "deposit": "1",
                  "gas": 100000000000000,
                  "method_name": "ft_transfer_call"
                }
              }
            ],
            "gas_price": "186029458",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "83AdQ16bpAC7BEUyF7zoRsAgeNW7HHmjhZLvytEsrygo",
        "receiver_id": "dev-1623333795623-21399959778159"
      },
      {
        "predecessor_id": "system",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "Transfer": {
                  "deposit": "1"
                }
              }
            ],
            "gas_price": "0",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "system",
            "signer_public_key": "ed25519:11111111111111111111111111111111"
          }
        },
        "receipt_id": "Euy4Q33DfvJTXD8HirE5ACoXnw9PMTQ2Hq47aGyD1spc",
        "receiver_id": "serhii.testnet"
      },
      {
        "predecessor_id": "system",
        "priority": 0,
        "receipt": {
          "Action": {
            "actions": [
              {
                "Transfer": {
                  "deposit": "18681184841157733814920"
                }
              }
            ],
            "gas_price": "0",
            "input_data_ids": [],
            "is_promise_yield": false,
            "output_data_receivers": [],
            "signer_id": "serhii.testnet",
            "signer_public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN"
          }
        },
        "receipt_id": "6ZDoSeV3gLFS2NXqMCJGEUR3VwBpSxBEPjnEEaAQfmXL",
        "receiver_id": "serhii.testnet"
      }
    ],
    "receipts_outcome": [
      {
        "block_hash": "BohRBwqjRHssDVS9Gt9dj3SYuipxHA81xXFjRVLqgGeb",
        "id": "83AdQ16bpAC7BEUyF7zoRsAgeNW7HHmjhZLvytEsrygo",
        "outcome": {
          "executor_id": "dev-1623333795623-21399959778159",
          "gas_burnt": 3734715409940,
          "logs": [],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [
            "Euy4Q33DfvJTXD8HirE5ACoXnw9PMTQ2Hq47aGyD1spc",
            "6ZDoSeV3gLFS2NXqMCJGEUR3VwBpSxBEPjnEEaAQfmXL"
          ],
          "status": {
            "Failure": {
              "ActionError": {
                "index": 0,
                "kind": {
                  "FunctionCallError": {
                    "ExecutionError": "Smart contract panicked: The account doesn't have enough balance"
                  }
                }
              }
            }
          },
          "tokens_burnt": "373471540994000000000"
        },
        "proof": []
      },
      {
        "block_hash": "4BzTmMmTjKvfs6ANS5gmJ6GQzhqianEGWq7SaxSfPbdC",
        "id": "Euy4Q33DfvJTXD8HirE5ACoXnw9PMTQ2Hq47aGyD1spc",
        "outcome": {
          "executor_id": "serhii.testnet",
          "gas_burnt": 0,
          "logs": [],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [],
          "status": {
            "SuccessValue": ""
          },
          "tokens_burnt": "0"
        },
        "proof": [
          {
            "direction": "Right",
            "hash": "5ipmcdgTieQqFXWQFCwcbZhFtkHE4PL4nW3mknBchpG6"
          }
        ]
      },
      {
        "block_hash": "4BzTmMmTjKvfs6ANS5gmJ6GQzhqianEGWq7SaxSfPbdC",
        "id": "6ZDoSeV3gLFS2NXqMCJGEUR3VwBpSxBEPjnEEaAQfmXL",
        "outcome": {
          "executor_id": "serhii.testnet",
          "gas_burnt": 0,
          "logs": [],
          "metadata": {
            "gas_profile": null,
            "version": 1
          },
          "receipt_ids": [],
          "status": {
            "SuccessValue": ""
          },
          "tokens_burnt": "0"
        },
        "proof": [
          {
            "direction": "Left",
            "hash": "9tcjij6M8Ge4aJcAa97He5nw8pH7PF8ZjRHVahBZD2VW"
          }
        ]
      }
    ],
    "status": {
      "Failure": {
        "ActionError": {
          "index": 0,
          "kind": {
            "FunctionCallError": {
              "ExecutionError": "Smart contract panicked: The account doesn't have enough balance"
            }
          }
        }
      }
    },
    "transaction": {
      "actions": [
        {
          "FunctionCall": {
            "args": "eyJyZWNlaXZlcl9pZCI6ImRldi0xNjIzMzMzOTE2MzY4LTU4NzA3NDM0ODc4NTMzIiwiYW1vdW50IjoiMTAwMDAwMDAwMCIsIm1zZyI6InRha2UtbXktbW9uZXkifQ==",
            "deposit": "1",
            "gas": 100000000000000,
            "method_name": "ft_transfer_call"
          }
        }
      ],
      "hash": "FQsh44pvEsK8RS9AbK868CmGwfhUU2pUrizkQ6wCWTsB",
      "nonce": 47589658000031,
      "priority_fee": 0,
      "public_key": "ed25519:5UfEFyve3RdqKkWtALMreA9jzsAGDgCtwEXGNtkGeruN",
      "receiver_id": "dev-1623333795623-21399959778159",
      "signature": "ed25519:2cPASnxKtCoQtZ9NFq63fg8RzpjvmmE8hL4s2jk8zuhnBCD3AnYQ6chZZrUBGwu7WrsGuWUyohP1bEca4vfbsorC",
      "signer_id": "serhii.testnet"
    },
    "transaction_outcome": {
      "block_hash": "FwHUeqmYpvgkL7eBrUUAEMCuaQshcSy5vm4AHchebhK1",
      "id": "FQsh44pvEsK8RS9AbK868CmGwfhUU2pUrizkQ6wCWTsB",
      "outcome": {
        "executor_id": "serhii.testnet",
        "gas_burnt": 2428166952740,
        "logs": [],
        "metadata": {
          "gas_profile": null,
          "version": 1
        },
        "receipt_ids": [
          "83AdQ16bpAC7BEUyF7zoRsAgeNW7HHmjhZLvytEsrygo"
        ],
        "status": {
          "SuccessReceiptId": "83AdQ16bpAC7BEUyF7zoRsAgeNW7HHmjhZLvytEsrygo"
        },
        "tokens_burnt": "242816695274000000000"
      },
      "proof": []
    }
  },
  "id": "myid"
}
```

</details>

For the [decoded result](/api/rpc/contracts#transaction-return-values), decode the successful `SuccessValue` as described in the RPC reference.

</Tab>
</Tabs>


Let's examine this response.

  * `result` » `transaction_outcome` » `outcome` » `status` » `SuccessReceiptId` is `83AdQ16bpAC7BEUyF7zoRsAgeNW7HHmjhZLvytEsrygo`
  * Find the outcome whose `id` matches that receipt ID, then inspect `outcome.status.Failure`. A missing outcome is pending; array position `0` is not a reliable receipt identifier.

`````
