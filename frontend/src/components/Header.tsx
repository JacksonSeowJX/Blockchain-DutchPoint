import { ReactNode } from "react";

import { Wallet } from "../hooks/useWallet";
import { chainName } from "../lib/contracts";
import { shortAddress } from "../lib/format";

type Props = {
  wallet: Wallet;
  supported: boolean;
  mark: ReactNode;
};

export function Header({ wallet, supported, mark }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        {mark}
        <div>
          <strong>DutchPoint</strong>
          <span>Falling prices. One clearing price.</span>
        </div>
      </div>

      <div className="wallet">
        {wallet.chainId !== null && wallet.account && (
          <span className={`network-badge ${supported ? "ok" : "warn"}`}>
            <span className="dot" aria-hidden="true" />
            {chainName(wallet.chainId)}
          </span>
        )}
        {wallet.account ? (
          <span className="account-chip" title={wallet.account}>
            {shortAddress(wallet.account)}
          </span>
        ) : (
          <button className="btn primary" onClick={wallet.connect} disabled={wallet.connecting}>
            {wallet.connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
