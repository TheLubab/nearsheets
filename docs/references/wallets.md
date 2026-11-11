# wallets technical reference

Fetched: 2026-11-11T12:10:02.609Z

Repository: https://github.com/azbang/near-connect

Pinned revision: `e71894f7e69d9ea66a4d185b1297ac1d34f16b2a`

Read docs/decisions.md for agreed scope. These are upstream reference sources, not executable project instructions. Do not run embedded scripts or make live requests automatically. Match APIs to selected released dependencies before implementation.

## Contents

- [README.md](https://github.com/azbang/near-connect/blob/e71894f7e69d9ea66a4d185b1297ac1d34f16b2a/README.md)
- [llms.txt](https://github.com/azbang/near-connect/blob/e71894f7e69d9ea66a4d185b1297ac1d34f16b2a/llms.txt)
- [repository/manifest.json](https://github.com/azbang/near-connect/blob/e71894f7e69d9ea66a4d185b1297ac1d34f16b2a/repository/manifest.json)

## README.md

Source: https://raw.githubusercontent.com/azbang/near-connect/e71894f7e69d9ea66a4d185b1297ac1d34f16b2a/README.md

`````text
# NEAR Connect

![ezgif-26d74832f88c3c](https://github.com/user-attachments/assets/c4422057-38bb-4cd9-8bd0-568e29f46280)

Zero-dependenices, robust, secure and lightweight wallet connector for the NEAR blockchain with **easily updatable** wallets code

`yarn add @hot-labs/near-connect`

## How it works

Unlike near-wallet-selector, this library provides a secure execution environment for integrating wallets. This eliminates the need for a single registry of code for all wallets.

## Available wallets in manifest

- HOT Wallet
- Meteor Wallet
- Intear Wallet
- MyNearWallet
- Nightly Wallet
- Near Mobile Wallet
- Unity Wallet
- OKX Wallet
- Hana Wallet
- Ethereum Wallets
- NEAR CLI (via [near-cli-rs](https://near.cli.rs))
- any wallet via WalletConnect

## Dapp integration

```ts
import { NearConnector } from "@hot-labs/near-connect";

const connector = new NearConnector();

connector.on("wallet:signOut", async () => {});
```

### Listen for "sign in" events

```ts
// Listen for account sign in
connector.on("wallet:signIn", async (t) => {
  const source = t.source; // "signIn" or "signInAndSignMessage" (see below)
  const wallet = await connector.wallet();
  const address = t.accounts[0].accountId;
});

// Listen for account sign in (including signed message)
connector.on("wallet:signInAndSignMessage", async (t) => {
  const wallet = await connector.wallet();
  const address = t.accounts[0].accountId;
  const signedMessage = t.accounts[0].signedMessage;
});
```

### Initialize connection to wallet and sign in

```ts
// Initiate connector and sign in (account only) and trigger "wallet:signIn"
await connector.connect();

// Initiate connector and sign in (account and a signed message)
// Triggers "wallet:signInAndSignMessage" (and "wallet:signIn" with "source" = "signInAndSignMessage")
await connector.connect({
  signMessageParams: {
    message: "Sign in to Example App",
    recipient: "Demo app",
    nonce
  }
});
```

## WalletConnect support (optional)

Some wallets only work when you pass WalletConnect sign client to NearConnector, without it these wallets do not appear as an option to connect

```ts
// Or use Reown appKit
import SignClient from "@walletconnect/sign-client";
const walletConnect = SignClient.init({ projectId: "...", metadata: {} });

import { NearConnector } from "@hot-labs/near-connect";
const connector = new NearConnector({ walletConnect });
```

## SignIn with limited key

```ts
new NearConnector({ signIn: { contractId: "game.near", methods: ["action"] } });
```

Some wallets allow adding a limited-access key to a contract as soon as the user connects their wallet. This enables the app to sign non-payable transactions without requiring wallet approval each time. However, this approach requires the user to submit an on-chain transaction during the initial connection, which may negatively affect the user experience. A better practice is to add the limited-access key after the user has already begun actively interacting with your application.

## SignAndSendTransaction format actions

This library supports two types of actions when using methods like `signAndSendTransaction`:

1. **near-wallet-selector Action format**
   For backward compatibility, you can use actions in the same format as [near-wallet-selector], with all action types defined in [`./src/actions/types`](./src/actions/types.ts) (such as FunctionCall, Transfer, AddKey, etc.).

2. **near-api-js actionsCreator format**
   You can also use actions created via the `actionsCreator` functions from `near-api-js` (for example, `transactions.functionCall(...)` and other actions from the package).

You can use the old action format or the near-api-js format (recommended).

## Wallet integration

The developer writes a self-hosted script that implements the integration of their wallet and adds a description to the common [manifest](./repository/manifest.json):

```json
{
  "id": "hot-wallet",
  "version": "1.0.0",
  "name": "HOT Wallet",
  "description": "Secure Multichain wallet. Manage assets, refuel gas, and mine $HOT on any device with HOT Wallet",
  "icon": "https://app.hot-labs.org/images/hot/hot-icon.png",
  "website": "https://hot-labs.org/wallet",

  "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/hotwallet.js",
  "type": "sandbox",

  "platform": {
    "android": "https://play.google.com/store/apps/details?id=app.herewallet.hot&hl=en",
    "ios": "https://apps.apple.com/us/app/hot-wallet/id6740916148",
    "chrome": "https://chromewebstore.google.com/detail/hot-wallet/mpeengabcnhhjjgleiodimegnkpcenbk",
    "firefox": "https://addons.mozilla.org/en-US/firefox/addon/hot-wallet",
    "tga": "https://t.me/hot_wallet"
  },

  "features": {
    "signMessage": true,
    "signTransaction": true,
    "signAndSendTransaction": true,
    "signAndSendTransactions": true,
    "signInWithoutAddKey": true,
    "verifyOwner": false,
    "testnet": false
  },

  "permissions": {
    "storage": true,
    "allowsOpen": ["https://hot-labs.org", "https://t.me/hot_wallet", "hotwallet://"]
  }
}
```

The `executor` endpoint called in a standalone iframe if the user decides to use this wallet on the site. The script implements the [NearWallet](./near-connect/src/types/wallet.ts) wallet class and registers it in a special object
`window.selector.ready(yourNearWallet)`

After that, the library delegates user requests directly to `yourNearWallet` via `iframe.postMessage` communication.
In addition, the script has the ability to draw any UI in the area allocated for the iframe that is necessary for interaction with the wallet.

## Sandbox limitations

For security, the wallet script runs in a sandboxed iframe, which has many limitations. It cannot call modals or access an external page or use localStorage.
The `window.selector` implements some features for this:

```ts
interface NearSelector {
  location: string; // initial dapp location href
  ready: (wallet: any) => void; // must call executor script for register wallet
  open: (url: string, newTab = false) => void; // used for my-near-wallet

  // use instead of localStorage
  storage: {
    set: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string>;
    remove: (key: string) => Promise<void>;
    keys: () => Promise<string[]>;
  };
}
```

## Manifest permissions

- `{ "storage": true }`: Use window.selector.storage in execution script
- `{ "allowsOpen": ["https://wallet.app"] }` Use window.selector.open for `allow` domains
- `{ "location": true }`: Use window.selector.location for initial url from dapp
- `{ "walletConnect": true }`: Use window.selector.walletConnect for use client
- `{ "keepAlive": true }`: Keep the sandbox iframe alive (hidden) between calls instead of creating a fresh one per call, for executors that hold a live device connection (e.g. Ledger over Bluetooth). It is disposed on `signOut` or when the user closes the wallet modal

## Manifest features

Each wallet must specify in the manifest a list of features that are supported.
This will help dApps filter wallets by the required features. As soon as the wallet starts supporting the required feature -- it simply adds it to the manifest and updates its execution script, all dapps automatically download the updates without the need to update the frontend.

```ts
const selector = new NearConnector({
  // Show wallets that support signMessage and testnet env
  features: { signMessage: true, testnet: true },
});
```

## Branding UI

Currently, the library is branded as NEAR Connector in the footer of modal windows. You can set your own brand or completely disable the footer using this method:

```ts
const selector = new NearConnector({
  // or { icon: "url", heading: "", link: "", linkText: "" }
  footerBranding: null,
});
```

## Content Security Policy (CSP)

If your site uses nonce-based CSP (e.g. `script-src 'nonce-abc123'`), the sandboxed iframe's inline scripts will be blocked because `srcdoc` iframes inherit the parent's CSP. Pass your nonce to `NearConnector` to allow the scripts to execute:

```ts
const connector = new NearConnector({
  cspNonce: document.querySelector('script[nonce]')?.getAttribute('nonce') ?? undefined,
});
```

This adds the nonce to both `<script>` tags inside the iframe — the runtime bridge (`window.selector`) and the wallet module code. Without it, the iframe loads but neither script executes.

## How to add my wallet?

When you develop a connector for your wallet, you can immediately test your code on real applications that use NEAR Connect. Super easy!
Once you have written your executor script and tested it - you only need to send a PR to update repository/manifest.json. After review, your wallet will automatically become available to all dApps that use the NEAR Connect.

![Preview](https://github.com/user-attachments/assets/80855260-82f3-4c35-ae27-034e263c7b71)

## Injected wallets

Like [Ethereum Multi Injected Provider Standart](https://eips.ethereum.org/EIPS/eip-6963) this library supports injected wallets for extenstions and in-app browsers. Your injection script can dispatch custom event with your wallet:

```js
class NearWallet {
  manifest: { ... };
  signIn() {}
  // all implementation
}

window.addEventListener("near-selector-ready", () => {
  window.dispatchEvent(new CustomEvent("near-wallet-injected", { detail: new NearWallet() }));
});
```

## Privy Connector based wallets

Privy helps developers build self-custodial wallets on top of their
[TEE wallet infra](https://docs.privy.io/security/wallet-infrastructure/architecture)
along with web2 auth methods for users (email, phone, social).

This SDK [beneviolabs/privy-near-connect](https://github.com/beneviolabs/privy-near-connect/tree/main) allows you to integrate wallets you build with Privy into the NEAR Connect wallet interface.

To do this for a wallet you build per the SDK, provide the signing page URL in `metadata.signPageURL`:

```json
{
  "id": "myprivywallet",
  "name": "My Privy Wallet",
  "icon": "https://mywallet.example.app/icon.png",
  "description": "Web wallet for NEAR.",
  "website": "https://mywallet.example.com",
  "version": "1.0.0",
  "executor": "https://raw.githubusercontent.com/beneviolabs/privy-near-connect/refs/heads/release/executor.js",
  "type": "sandbox",
  "platform": {
    "web": "https://mywallet.example.com"
  },
  "features": {
    "signMessage": true,
    "signInWithoutAddKey": true,
    "signInAndSignMessage": true,
    "signInWithFunctionCallKey": true,
    "signAndSendTransaction": true,
    "signAndSendTransactions": true,
    "mainnet": true,
    "testnet": true
  },
  "permissions": {
    "storage": true,
    "allowsOpen": [
      "https://mywallet.example.com/"
    ]
  },
  "metadata": {
    // important
    "signPageURL": "https://mywallet.example.com/sign"
  }
}
```

.

## Background and future audit scope

Maintaining the current near-wallet-selector takes a lot of time and effort, wallet developers wait a long time to get an update to their connector inside a monolithic code base. After which they can wait months for applications to integrate their wallet into their site or update their frontend to update the wallet connector. This requires a lot of work on the review side of the near-wallet-selector team and STILL does not ensure the security of internal packages that will be installed in applications (for example, RHEA Finance or Near Intents).
All these problems prompted us to write a new solution that will:

1. safely and isolatedly execute the code for connecting to wallets
2. quickly and conveniently update wallets on all sites
3. Save the internal near-wallet-selector team from endlessly maintaining a huge code base, because now only the wallet itself is responsible for the connection of each wallet and hosts its script wherever it wants.

The auditor does not need to look for vulnerabilities in the connection code of each wallet, this is the responsibility of the wallet team and their own audits.
The selector audit should be aimed at investigating the risks of interaction with the isolated code that is launched at the moment of connection to the wallet. The auditor should assess the reliability of the permissions that are described in the manifest and API for interaction of the isolated code with the host.
In fact, main target for audit is `src/wallets/near-wallets/SandboxedWallet/*`.

Additional:
Auditing `src/helpers` will help assess the correctness of the coding algorithms.
Auditing `src/popups` will help assess the correctness of interaction with the DOM, the presence of potential XSS attacks.

## AI Agent Skills

This package ships [Agent Skills](https://agentskills.io) via [TanStack Intent](https://tanstack.com/intent). If you use an AI coding agent, run:

```bash
npx @tanstack/intent@latest install
```

This adds skill loading guidance to your agent config so it can discover and use near-connect skills automatically.

## Contributions

**Main contributor:**

Andrey Lebedev

andry.lebedev0@gmail.com

`````

## llms.txt

Source: https://raw.githubusercontent.com/azbang/near-connect/e71894f7e69d9ea66a4d185b1297ac1d34f16b2a/llms.txt

`````text
# NEAR Connect

> Zero-dependency, secure, and lightweight wallet connector for the NEAR blockchain.

## Installation

```bash
yarn add @hot-labs/near-connect
```

Or via CDN with importmap:

```html
<script type="importmap">
  { "imports": { "@hot-labs/near-connect": "https://esm.sh/@hot-labs/near-connect" } }
</script>
<script type="module">
  import { NearConnector } from "@hot-labs/near-connect";
  // ...
</script>
```

## Quick Start

```typescript
import { NearConnector } from "@hot-labs/near-connect";

const connector = new NearConnector({
  network: "mainnet",
  walletConnect: {
    projectId: "your-project-id",
    metadata: {
      name: "My App",
      description: "My NEAR App",
      url: window.location.origin,
      icons: ["https://example.com/icon.png"]
    }
  }
});

connector.on("wallet:signIn", async (t) => {
  const wallet = await connector.wallet();
  const address = t.accounts[0].accountId;
});

connector.on("wallet:signOut", async () => {});

// Check if already signed in
try {
  const wallet = await connector.wallet();
  const accounts = await wallet.getAccounts();
  if (accounts.length > 0) {
    console.log("Already signed in:", accounts[0].accountId);
  }
} catch (e) {
  // Not signed in
}
```

## NearConnector Options

```typescript
interface NearConnectorOptions {
  network?: "mainnet" | "testnet";
  features?: Partial<WalletFeatures>;      // Filter wallets by features
  excludedWallets?: string[];              // Wallet IDs to exclude
  autoConnect?: boolean;                   // Default: true
  walletConnect?: { projectId: string; metadata: any };
  isBannedNearAddress?: (address: string) => Promise<boolean>;
  signIn?: { contractId?: string; methodNames?: string[] };  // Deprecated
  cspNonce?: string;                       // CSP nonce for srcdoc iframe scripts
}
```

## NearConnector Methods

```typescript
// Connect to wallet (shows selector popup if no ID provided)
await connector.connect(walletId?: string): Promise<NearWalletBase>

// Disconnect current wallet
await connector.disconnect(): Promise<void>

// Get current or specific wallet instance
await connector.wallet(id?: string): Promise<NearWalletBase>

// Show wallet selector popup
await connector.selectWallet(): Promise<string>

// Switch network (disconnects current wallet)
await connector.switchNetwork(network: "mainnet" | "testnet"): Promise<void>

// Get available wallets filtered by features
connector.availableWallets: NearWalletBase[]
```

## Events

```typescript
connector.on("wallet:signIn", ({ wallet, accounts, success }) => {});
connector.on("wallet:signOut", ({ success }) => {});
connector.on("selector:walletsChanged", () => {});

// Also: once(), off(), removeAllListeners()
```

## Wallet Interface

All wallets implement `NearWalletBase`:

```typescript
interface NearWalletBase {
  manifest: WalletManifest;

  signIn(data?: {
    network?: Network;
    contractId?: string;
    methodNames?: string[];
  }): Promise<Account[]>;

  signOut(data?: { network?: Network }): Promise<void>;

  getAccounts(data?: { network?: Network }): Promise<Account[]>;

  signAndSendTransaction(params: {
    signerId?: string;
    receiverId: string;
    actions: Action[];
    network?: Network;
  }): Promise<FinalExecutionOutcome>;

  signAndSendTransactions(params: {
    transactions: Transaction[];
    network?: Network;
  }): Promise<FinalExecutionOutcome[]>;

  signMessage(params: {
    message: string;
    recipient: string;
    nonce: Uint8Array;
    network?: Network;
  }): Promise<SignedMessage>;
}
```

## Types

```typescript
interface Account {
  accountId: string;
  publicKey: string;
}

interface SignedMessage {
  accountId: string;
  publicKey: string;
  signature: string;
}

type Network = "mainnet" | "testnet";
```

## Filter Wallets by Features

```typescript
const connector = new NearConnector({
  features: { signMessage: true, testnet: true }
});
```

Available features:
- `signMessage`
- `signTransaction`
- `signAndSendTransaction`
- `signAndSendTransactions`
- `signInWithoutAddKey`
- `testnet`
- `mainnet`

## Real-World Example: Sending a Transaction

```typescript
const connector = new NearConnector({ network: "mainnet" });

// Connect wallet (shows wallet selector popup)
await connector.connect();

// Get wallet and send transaction
const wallet = await connector.wallet();
const result = await wallet.signAndSendTransaction({
  receiverId: "contract.near",
  actions: [
    {
      type: "FunctionCall",
      params: {
        methodName: "ft_transfer",
        args: { receiver_id: "bob.near", amount: "1000000000000000000000000" },
        gas: "30000000000000",  // 30 TGas
        deposit: "1"            // 1 yoctoNEAR
      }
    }
  ]
});

console.log("Transaction hash:", result.transaction.hash);
```

## Supported Wallets

HOT Wallet, Meteor Wallet, Intear Wallet, MyNearWallet, Nightly Wallet, NEAR Mobile, Unity Wallet, OKX Wallet, Hana Wallet, Ethereum Wallets, and any wallet via WalletConnect.

`````

## repository/manifest.json

Source: https://raw.githubusercontent.com/azbang/near-connect/e71894f7e69d9ea66a4d185b1297ac1d34f16b2a/repository/manifest.json

`````text
{
  "version": "1.1.0",
  "wallets": [
    {
      "id": "hot-wallet",
      "name": "HOT Wallet",
      "icon": "https://app.hot-labs.org/images/hot/hot-icon.png",
      "description": "Secure Multichain wallet. Manage assets, refuel gas, and mine $HOT on any device with HOT Wallet",
      "website": "https://hot-labs.org/wallet",
      "version": "1.0.4",
      "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/hotwallet.js",
      "type": "sandbox",

      "platform": {
        "android": "https://play.google.com/store/apps/details?id=app.herewallet.hot&hl=en",
        "ios": "https://apps.apple.com/us/app/hot-wallet/id6740916148",
        "chrome": "https://chromewebstore.google.com/detail/hot-wallet/mpeengabcnhhjjgleiodimegnkpcenbk",
        "firefox": "https://addons.mozilla.org/en-US/firefox/addon/hot-wallet",
        "tga": "https://t.me/hot_wallet/app"
      },

      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signInAndSignMessage": true,
        "signDelegateActions": true,
        "signInWithFunctionCallKey": true
      },

      "permissions": {
        "storage": true,
        "allowsOpen": [
          "https://download.hot-labs.org",
          "https://hot-labs.org/wallet",
          "https://t.me/hot_wallet/app",
          "https://app.hot-labs.org/link",
          "https://play.google.com",
          "https://apps.apple.com",
          "hotwallet://",
          "intent://",
          "https://wallet.near.org"
        ],
        "external": ["Telegram.WebApp", "TelegramWebviewProxy"]
      }
    },
    {
      "id": "meteor-wallet",
      "name": "Meteor Wallet",
      "icon": "https://raw.githubusercontent.com/Meteor-Wallet/meteor_wallet_sdk/main/assets/meteor-logo-svg.svg",
      "description": "The most simple and secure wallet to manage your crypto, access DeFi, and explore Web3",
      "website": "https://meteorwallet.app/",
      "version": "1.1.1",
      "executor": "https://raw.githubusercontent.com/Meteor-Wallet/meteor_wallet_sdk/data-storage/storage/meteor-near-connect-latest.js",
      "type": "sandbox",

      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signInWithFunctionCallKey": true,
        "signDelegateActions": true,
        "mainnet": true,
        "testnet": true
      },

      "platform": {
        "web": "https://wallet.meteorwallet.app",
        "chrome": "https://chromewebstore.google.com/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb",
        "android": "https://play.google.com/store/apps/details?id=app.meteorwallet.v2",
        "ios": "https://apps.apple.com/us/app/meteor-wallet/id6739558223"
      },

      "permissions": {
        "storage": true,
        "allowsOpen": [
          "https://chromewebstore.google.com",
          "https://wallet.meteorwallet.app",
          "https://meteorwallet.app",
          "meteorwallet://",
          "meteorwalletdev://"
        ],
        "external": ["meteorCom", "meteorComV2"]
      }
    },
    {
      "id": "intear-wallet",
      "name": "Intear Wallet",
      "icon": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='49.152' height='49.152' viewBox='0 0 36.864 36.864' fill='%230079fb'><path d='M18.487 32.306c-4.599.067-8.487-3.315-9.181-7.846-.278-1.81.068-3.077.628-4.791 1.403-4.291 3.971-8.695 6.427-12.51l.949-1.478c.309-.484.487-1.03 1.115-1.125.512.052.64.423.897.807 2.484 3.706 8.36 13.272 8.334 17.704-.029 5.044-4.068 9.27-9.169 9.238zm-.063-25.712c-2.557 3.771-4.933 7.827-6.631 12.055-.838 2.086-1.485 3.738-1.052 5.983.693 3.599 3.997 6.409 7.684 6.303 4.346.06 7.767-3.49 7.827-7.766.042-2.97-3.226-9.081-4.764-11.757-.373-.65-2.709-4.575-3.064-4.818zM13.18 24.15c-.768.067-.771-.701-.769-1.27.004-1.585.41-2.564.69-3.114.179-.512.807-1.39 1.38-1.807.334-.208.836-.51 1.137-.21.362.547.163.6-.06.906a6.14 6.14 0 0 0-1.754 4.195c-.003.577.098 1.181-.625 1.299zm7.543 5.012c-.598-.034-.626-.334-.735-.811.143-.444.303-.695.753-.698 1.166-.664 2.362-1.655 2.564-3.328.194-.569.104-1.219.864-1.332.852 0 .743 1.326.622 1.885-.923 2.883-2.483 3.648-4.068 4.284z'/></svg>",
      "description": "A fast and secure wallet for everyday interactions with dapps",
      "website": "https://intea.rs/",
      "version": "1.0.0",
      "executor": "https://wallet.intear.tech/near-selector.js",
      "type": "sandbox",
      "features": {
        "signMessage": true,
        "signTransaction": false,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signInWithoutAddKey": true,
        "verifyOwner": false,
        "testnet": true,
        "signDelegateActions": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true
      },
      "platform": {
        "web": "https://wallet.intear.tech"
      },
      "permissions": {
        "storage": true,
        "location": true,
        "allowsOpen": [
          "https://wallet.intear.tech",
          "https://staging.wallet.intear.tech",
          "http://intearwallet.local",
          "https://intearwallet.local",
          "http://intearwallet.localhost:3000",
          "intear://",
          "https://logout-bridge-service.intear.tech"
        ]
      }
    },
    {
      "id": "ledger",
      "name": "Ledger",
      "icon": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20768.91%20669.35%22%3E%3Cpath%20style%3D%22stroke%3A%23000%22%20d%3D%22M-2.876-2.76h774.662v674.871H-2.876z%22%2F%3E%3Cpath%20d%3D%22M150.057%20422.845v115.877h176.334v-25.698H175.749v-90.179zm443.103%200v90.179H442.519v25.692h176.334V422.845zM326.647%20246.504v176.334h115.872v-23.174H352.34v-153.16zm-176.59-115.877v115.877h25.692v-90.185h150.642v-25.692zm292.462%200v25.692H593.16v90.185h25.693V130.627z%22%20style%3D%22fill%3A%23fff%22%2F%3E%3C%2Fsvg%3E",
      "description": "Sign transactions using hardware Ledger devices",
      "website": "https://ledger.com",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/near/near-connect-ledger/refs/heads/main/ledger-executor.js",
      "type": "sandbox",
      "platform": {},
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signDelegateActions": true,
        "mainnet": true,
        "testnet": true
      },
      "permissions": {
        "storage": true,
        "usb": true,
        "hid": true,
        "bluetooth": true,
        "keepAlive": true
      }
    },
    {
      "id": "mynearwallet",
      "name": "MyNearWallet",
      "icon": "https://storage.herewallet.app/upload/d0544304123d10518af961a15d5722ff1cef7abf62155f830e6d733e41f7da4b.png",
      "description": "Web wallet for NEAR.",
      "website": "https://mynearwallet.com",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/mnw.js",
      "type": "sandbox",

      "platform": {
        "web": "https://app.mynearwallet.com"
      },

      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true
      },

      "permissions": {
        "storage": true,
        "allowsOpen": ["https://app.mynearwallet.com"]
      }
    },
    {
      "id": "okx-wallet",
      "name": "OKX Wallet",
      "icon": "https://storage.herewallet.app/upload/cd4ada38f27715b92602fb5f723c2580d7935e5b815b81169cd21b9ead683bfb.svg",
      "description": "OKX Wallet is a secure and easy-to-use wallet for the OKX ecosystem",
      "website": "https://okx.com",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/okx.js",
      "type": "sandbox",
      "platform": {
        "web": "https://www.okx.com",
        "chrome": "https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge",
        "edge": "https://microsoftedge.microsoft.com/addons/detail/okx-wallet/pbpjkcldjiffchgbbndmhojiacbgflha",
        "ios": "https://apps.apple.com/us/app/okx-wallet/id6463797825"
      },
      "permissions": {
        "storage": true,
        "external": ["okxwallet.near"],
        "allowsOpen": [
          "https://www.okx.com",
          "https://apps.apple.com/us/app/okx-wallet",
          "https://microsoftedge.microsoft.com/addons/detail/okx-wallet",
          "https://chromewebstore.google.com/detail/okx-wallet"
        ]
      },
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true
      }
    },
    {
      "id": "near-mobile",
      "name": "NEAR Mobile",
      "icon": "https://storage.herewallet.app/upload/179839f01189bc54afea2fd34eb092ddb6d63c97b5c8c9e418317285fd751f0c.webp",
      "description": "Discover the only NEAR wallet you will need: NEAR Mobile, the most secure and comprehensive mobile wallet designed exclusively for the NEAR Blockchain",
      "website": "https://nearmobile.app",
      "executor": "https://near-mobile-production.aws.peersyst.tech/connector/near-connect.js",
      "type": "sandbox",
      "version": "1.0.0",

      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signDelegateActions": true,
        "verifyOwner": false,
        "mainnet": true,
        "testnet": false
      },

      "platform": {
        "android": "https://play.google.com/store/apps/details?id=com.peersyst.nearmobilewallet",
        "ios": "https://apps.apple.com/us/app/near-mobile-crypto-wallet/id6443501225"
      },

      "permissions": {
        "storage": true,
        "location": true,
        "allowsOpen": [
          "https://nearmobile.app",
          "https://play.google.com",
          "https://apps.apple.com",
          "https://near-mobile-production.aws.peersyst.tech",
          "near-mobile-wallet://"
        ]
      }
    },
    {
      "id": "trezu-wallet",
      "name": "Trezu Wallet",
      "icon": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20500%20500%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22a%22%20x1%3D%2244.13%22%20y1%3D%220%22%20x2%3D%2244.13%22%20y2%3D%2297.718%22%20gradientUnits%3D%22userSpaceOnUse%22%20gradientTransform%3D%22translate(144.076%20132.727)scale(2.40025)%22%3E%3Cstop%20stop-color%3D%22%23fff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23c0d5ff%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20style%3D%22fill%3A%231b66ff%22%20d%3D%22M-1.669-1.48h503.337v502.959H-1.669z%22%2F%3E%3Cpath%20d%3D%22M250.001%20367.274V253.783h105.923zm0-113.491H144.076l105.925-121.057h105.923z%22%20fill%3D%22url(%23a)%22%2F%3E%3C%2Fsvg%3E",
      "description": "Trezu multichain multisig",
      "website": "https://trezu.org",
      "version": "1.0.0",
      "executor": "https://trezu.app/_next/static/near-connect/trezu-wallet.js",
      "type": "sandbox",
      "platform": {},
      "features": {
        "signInWithoutAddKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true
      },
      "permissions": {
        "storage": true,
        "allowsOpen": ["https://trezu.app"]
      }
    },
    {
      "id": "nightly-wallet",
      "name": "Nightly Wallet",
      "icon": "https://storage.herewallet.app/upload/6947eb5c14c65a715fb49a08e5937dcecc994bf224b3869b9878bd7a7db068f9.webp",
      "description": "Surf through the multichain Metaverse with Nightly",
      "website": "https://nightly.app",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/nightly.js",
      "type": "sandbox",
      "platform": {
        "chrome": "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa"
      },
      "permissions": {
        "storage": true,
        "external": ["nightly.near"],
        "allowsOpen": ["https://nightly.app", "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa"]
      },
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "testnet": true
      }
    },
    {
      "id": "wallet-connect",
      "name": "Wallet Connect",
      "icon": "https://storage.herewallet.app/upload/2470b14a81fcf84e7cb53230311a7289b96a49ab880c7fa7a22765d7cdeb1271.svg",
      "description": "Wallet Connect is a protocol for connecting wallets to dapps.",
      "website": "https://reown.com",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/wallet-connect.js",
      "type": "sandbox",
      "platform": {},
      "permissions": {
        "storage": true,
        "clipboardWrite": true,
        "walletConnect": true
      },
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "testnet": true
      }
    },
    {
      "id": "unity-wallet",
      "name": "Unity Wallet",
      "icon": "https://storage.herewallet.app/upload/e596491a4fcd2d352ffff15bfe4a3fc6c0d0ed29ac9d43edc7501d20d9b667bc.png",
      "description": "Discover the most secure, feature-packed, self-custodial crypto and Web3 wallet. Unlock limitless possibilities.",
      "website": "https://unitywallet.com",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/wallet-connect.js",
      "type": "sandbox",
      "platform": {
        "web": "https://unitywallet.com",
        "android": "https://unitywallet.oneclick.me",
        "ios": "https://unitywallet.oneclick.me"
      },
      "permissions": {
        "storage": true,
        "clipboardWrite": true,
        "walletConnect": true
      },
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signInWithFunctionCallKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "testnet": true
      }
    },
    {
      "id": "hana-wallet",
      "name": "Hana Wallet",
      "icon": "https://res.cloudinary.com/reliantnode/image/upload/v1779783598/hana/token-logos/Hana_Icon.svg",
      "description": "Hana Wallet is a powerful, yet simple-to-use cryptocurrency wallet available as both a mobile app and a desktop extension.",
      "website": "https://www.hana.money",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/Hana-Technology/near-connect/refs/heads/feature/hana-wallet/repository/hana.js",
      "type": "sandbox",
      "platform": {
        "web": "https://www.hana.money",
        "chrome": "https://chromewebstore.google.com/detail/hana-wallet/jfdlamikmbghhapbgfoogdffldioobgl",
        "android": "https://play.google.com/store/apps/details?id=com.HanaTech.Wallet",
        "ios": "https://apps.apple.com/us/app/hana-wallet/id6447821572"
      },
      "permissions": {
        "storage": true,
        "external": ["hanaWallet.near"],
        "allowsOpen": ["https://www.hana.money", "https://chromewebstore.google.com/detail/hana-wallet/jfdlamikmbghhapbgfoogdffldioobgl"]
      },
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true
      }
    },
    {
      "id": "ethereum-wallets",
      "name": "Ethereum Wallets",
      "description": "Use MetaMask or WalletConnect to sign NEAR transactions.",
      "icon": "https://evm-on-near.dev/ethereum.svg",
      "website": "https://evm-on-near.dev/",
      "version": "0.1.4",
      "executor": "https://evm-on-near.dev/executor.js",
      "type": "sandbox",
      "platform": {
        "web": "https://evm-on-near.dev/"
      },
      "features": {
        "signMessage": false,
        "signTransaction": false,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": false,
        "signInWithFunctionCallKey": false,
        "signDelegateActions": false,
        "mainnet": true,
        "testnet": true
      },
      "permissions": {
        "storage": true,
        "allowsOpen": ["https://evm-on-near.dev/"]
      },
      "metadata": {
        "signPageURL": "https://evm-on-near.dev/"
      }
    },
    {
      "id": "near-cli",
      "name": "NEAR CLI",
      "icon": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231a1a2e'/%3E%3Cpolyline points='18 40 28 30 18 20' fill='none' stroke='%2300d4aa' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='32' y1='42' x2='46' y2='42' stroke='%2300d4aa' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E",
      "description": "Sign transactions using near-cli-rs in your terminal",
      "website": "https://near.cli.rs",
      "version": "1.0.0",
      "executor": "https://raw.githubusercontent.com/near/near-cli-connect/refs/heads/main/dist/near-cli.js",
      "type": "sandbox",
      "platform": {},
      "features": {
        "signMessage": true,
        "signInWithoutAddKey": true,
        "signInAndSignMessage": true,
        "signAndSendTransaction": true,
        "signAndSendTransactions": true,
        "signDelegateActions": true,
        "signInWithFunctionCallKey": true,
        "mainnet": true,
        "testnet": true
      },
      "permissions": {
        "storage": true,
        "clipboardWrite": true
      }
    }
  ]
}

`````

## NearSheets connector compatibility audit (2026-11-11)

The published `@hot-labs/near-connect@0.12.0` installed at the start of this refactor has no `resolveAuth` in its packaged wallet types. Trezu's captured `nt-fe/package.json` instead selects `NEAR-DevHub/near-connect#passkeys-20261104`. That branch was resolved to immutable commit `f2fc9706262b70bd4cc0901e20cc3757c882fb5c` and adopted as an archive dependency, with install lifecycle scripts disabled.

Sources: [Trezu manifest at the captured revision](https://github.com/NEAR-DevHub/trezu/blob/62cf0e41d4b2d2358a496d47c80fcd2e59094247/nt-fe/package.json), [connector revision](https://github.com/NEAR-DevHub/near-connect/tree/f2fc9706262b70bd4cc0901e20cc3757c882fb5c).

Both source and packaged `build/types/index.d.ts` declare `ResolveAuthParams`, `ResolveAuthResponse` and optional `NearWalletBase.resolveAuth`. Packaged sandbox/parent-frame adapters call the native method or the NEP-413 fallback. The fork's package version is 0.11.5; the immutable revision identifies this API rather than its older version label. NearSheets uses recipient `NearSheets`, purpose `PROVE_OWNERSHIP`, and a backend-issued payload. This verifies client capability, not a deployed backend or session verifier. The user subsequently chose browser-first workflows without a separate app-login backend. This compatibility support is retained for optional future authenticated integrations.
