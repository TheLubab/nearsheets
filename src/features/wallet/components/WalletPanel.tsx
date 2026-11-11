import { NEAR_NETWORKS, type NearNetwork } from "../../../integrations/near/network";
import type { WalletState } from "../application/wallet-controller";
import type { WalletController } from "../application/wallet-controller";

interface WalletPanelProps {
  wallet: WalletController;
  state: WalletState;
}

function networkLabel(network: NearNetwork): string {
  return network === "mainnet" ? "Mainnet" : "Testnet";
}

/**
 * Wallet connection UI.
 *
 * Two rules shape it:
 * - Local editing never depends on this panel; a failure here leaves the
 *   spreadsheet usable.
 * - A cancelled selector returns to "Not connected" with an explanation and no
 *   error styling, so the user can retry without clearing anything.
 */
export function WalletPanel({ wallet, state }: WalletPanelProps) {
  const { status, connection, error, cancelled, network } = state;
  const connecting = status === "connecting";
  const disconnecting = status === "disconnecting";
  const connected = status === "connected" && connection !== null;

  return (
    <section className="wallet-panel" aria-label="Wallet">
      <div className="wallet-panel__row">
        <span
          className={`wallet-panel__dot wallet-panel__dot--${connected ? "on" : "off"}`}
          aria-hidden="true"
        />
        {connected ? (
          <>
            <span className="wallet-panel__account" title={connection.accountId}>
              {connection.accountId}
            </span>
            <span className="wallet-panel__wallet">{connection.walletName}</span>
            <span className="wallet-panel__network">{networkLabel(network)}</span>
            <button
              type="button"
              onClick={() => void wallet.disconnect()}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        ) : (
          <>
            <span className="wallet-panel__account">Not connected</span>
            <span className="wallet-panel__network">{networkLabel(network)}</span>
            <button
              type="button"
              onClick={() => void wallet.connect()}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          </>
        )}

        <label className="wallet-panel__network-select">
          <span>Wallet network</span>
          <select
            value={network}
            disabled={connecting || disconnecting}
            onChange={(event) => {
              const next = event.target.value as NearNetwork;
              void wallet.setNetwork(next);
            }}
          >
            {NEAR_NETWORKS.map((value) => (
              <option key={value} value={value}>
                {networkLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cancelled ? (
        <p className="wallet-panel__notice" role="status">
          Wallet connection was cancelled. Nothing changed; connect whenever you
          are ready.
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => wallet.dismissCancelled()}
          >
            ×
          </button>
        </p>
      ) : null}

      {error ? (
        <p className="wallet-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="wallet-panel__hint">
        Connecting only identifies your account. It does not sign, submit or
        move funds, and you can keep editing without a wallet.
      </p>
    </section>
  );
}