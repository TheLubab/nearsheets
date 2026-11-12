import { WalletIcon } from "@solar-icons/react/linear/wallet";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
import { flushSync } from "react-dom";
import { NEAR_NETWORKS, type NearNetwork } from "../../../integrations/near/network";
import type { WalletState, WalletController } from "../application/wallet-controller";

interface WalletPanelProps {
  wallet: WalletController;
  state: WalletState;
}

function networkLabel(network: NearNetwork): string {
  return network === "mainnet" ? "Mainnet" : "Testnet";
}

export function WalletPanel({ wallet, state }: WalletPanelProps) {
  const { status, connection, error, cancelled, network } = state;
  const busy = status === "connecting" || status === "disconnecting";

  return (
    <section className="wallet-panel" aria-label="Wallet">
      <div className="wallet-panel__settings">
        {connection ? <p>Changing networks disconnects your wallet.</p> : null}
        <span className="wallet-panel__network-control">
          <select id="wallet-network" aria-label="Network" value={network} disabled={busy} onChange={(event) => void wallet.setNetwork(event.target.value as NearNetwork)}>
            {NEAR_NETWORKS.map((value) => <option key={value} value={value}>{networkLabel(value)}</option>)}
          </select>
          <AltArrowDownIcon size={14} aria-hidden="true"/>
        </span>
      </div>

      {connection ? (
        <div className="wallet-panel__identity">
          <div className="wallet-panel__identity-heading">
            <span className="wallet-panel__icon" aria-hidden="true"><WalletIcon size={21}/></span>
            <span className="wallet-panel__connected"><span aria-hidden="true"/>Connected</span>
          </div>
          <span className="wallet-panel__account" title={connection.accountId}>{connection.accountId}</span>
          <span className="wallet-panel__wallet">{connection.walletName}</span>
        </div>
      ) : (
        <div className="wallet-panel__choices">
          <button type="button" className="wallet-panel__choice" onClick={() => flushSync(() => { void wallet.connect(); })} disabled={busy}>
            <img className="wallet-panel__near-icon" src={`${import.meta.env.BASE_URL}near-wallet-mark.svg`} alt="" />
            <span className="wallet-panel__choice-title">NEAR wallets</span>
          </button>
          {false && <button type="button" className="wallet-panel__choice" onClick={() => flushSync(() => { void wallet.connect("trezu-wallet"); })} disabled={busy || network !== "mainnet"}>
            <img className="wallet-panel__trezu-icon" src={`${import.meta.env.BASE_URL}trezu-wallet-mark.svg`} alt="" />
            <span className="wallet-panel__choice-title">Trezu Wallet</span>
            {network !== "mainnet" ? <span className="wallet-panel__availability">Mainnet only</span> : null}
          </button>}
          {status === "connecting" ? <span className="wallet-panel__progress" role="status">Connecting…</span> : null}
        </div>
      )}

      {cancelled ? (
        <div className="wallet-panel__notice" role="status">
          <span>Wallet selection cancelled.</span>
          <button type="button" onClick={() => wallet.clearFeedback()}>Dismiss</button>
        </div>
      ) : null}
      {error ? <p className="wallet-panel__error" role="alert">{error}</p> : null}

      {connection ? (
        <button type="button" className="wallet-panel__disconnect" onClick={() => void wallet.disconnect()} disabled={busy}>
          {status === "disconnecting" ? "Disconnecting…" : "Disconnect wallet"}
        </button>
      ) : null}
    </section>
  );
}
