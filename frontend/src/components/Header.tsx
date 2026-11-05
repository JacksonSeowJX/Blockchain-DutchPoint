import { ReactNode } from "react";

import { ThemeChoice } from "../hooks/useTheme";
import { Wallet } from "../hooks/useWallet";
import { chainName } from "../lib/contracts";
import { shortAddress } from "../lib/format";
import { ThemeIcon } from "./icons";

type Props = {
  wallet: Wallet;
  supported: boolean;
  theme: ThemeChoice;
  onCycleTheme: () => void;
  mark: ReactNode;
};

const THEME_LABELS: Record<ThemeChoice, string> = { system: "Auto", light: "Light", dark: "Dark" };

export function Header({ wallet, supported, theme, onCycleTheme, mark }: Props) {
  const themeLabel = THEME_LABELS[theme];

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
        <button
          className="theme-toggle"
          onClick={onCycleTheme}
          title="Switch between automatic, light and dark themes"
          aria-label={`Theme: ${themeLabel}. Click to change.`}
        >
          <ThemeIcon theme={theme} />
          {themeLabel}
        </button>
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
