import { BidHistory } from "../components/BidHistory";
import { BidPanel } from "../components/BidPanel";
import { DevTools } from "../components/DevTools";
import { NotDeployed } from "../components/NotDeployed";
import { PositionPanel } from "../components/PositionPanel";
import { SaleInfo } from "../components/SaleInfo";
import { SettlementPanel } from "../components/SettlementPanel";
import { Dashboard } from "../hooks/useDashboard";
import { Status, View } from "../lib/auctionMath";
import { LOCAL_CHAIN_ID, chainName, defaultChainId } from "../lib/contracts";
import { formatEth, formatPrice, formatToken, secondsToClock, trimDecimal } from "../lib/format";
import { formatEther } from "ethers";

export type DirectionProps = { d: Dashboard };

/** A price as bare figures. While it is falling, `steady` keeps six decimals so the width holds still. */
export function priceFigure(price: bigint, steady = false): string {
  const figure = trimDecimal(formatEther(price), 6);
  if (!steady) {
    return figure;
  }
  const [whole, fraction = ""] = figure.split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

/** The clock figure and what it counts down to, for each stage of the auction. */
export function countdown(view: View): { clock: string; caption: string } {
  if (view.status === Status.Pending) {
    return { clock: "20:00", caption: "bidding window" };
  }
  if (view.status === Status.Active) {
    return { clock: secondsToClock(view.remainingSeconds), caption: "left to bid" };
  }
  if (view.status === Status.Cleared) {
    return { clock: secondsToClock(view.remainingSeconds), caption: "until claims open" };
  }
  return { clock: "00:00", caption: "window closed" };
}

/** The headline figures: the price, what has been committed and by how many bidders, the supply and the price range. */
export function Summary({ d }: DirectionProps) {
  const { snapshot, view } = d;
  if (!snapshot || !view) {
    return null;
  }
  return (
    <section className="stats" aria-label="Auction summary">
      <div className="stat">
        <span>{view.clearing.cleared || view.status === Status.Finalized ? "Clearing price" : "Current price"}</span>
        <strong>{formatPrice(view.price)}</strong>
        <small>per GVRA</small>
      </div>
      <div className="stat">
        <span>Total committed</span>
        <strong>{formatEth(snapshot.totalCommitted)}</strong>
        <small>
          {snapshot.participantCount.toString()} {snapshot.participantCount === 1n ? "bidder" : "bidders"}
        </small>
      </div>
      <div className="stat">
        <span>For sale</span>
        <strong>{formatToken(snapshot.saleSupply, snapshot.tokenSymbol, 0)}</strong>
        <small>fixed supply</small>
      </div>
      <div className="stat">
        <span>Price range</span>
        <strong>{formatPrice(snapshot.startPrice)}</strong>
        <small>down to {formatPrice(snapshot.reservePrice)} reserve</small>
      </div>
    </section>
  );
}

export function Notices({ d }: DirectionProps) {
  const { tx, deployment, wallet, wrongNetwork, error, offline } = d;
  const txLink = (hash: string) =>
    deployment?.explorer ? (
      <a href={`${deployment.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
        View transaction
      </a>
    ) : (
      <code title={hash}>{hash.slice(0, 10)}…</code>
    );

  return (
    <div className="notices">
      {/* Without a deployment, the NotDeployed card offers the switch instead. */}
      {wrongNetwork && deployment && (
        <div className="notice warning" role="status">
          DutchPoint isn't deployed on {chainName(wallet.chainId!)}.
          <button className="btn small" onClick={d.switchNetwork}>
            Switch to {wrongNetwork}
          </button>
        </div>
      )}
      {wallet.error && <div className="notice error">{wallet.error}</div>}
      {error && (
        <div className={`notice ${offline ? "warning" : "error"}`} role="status">
          {error}
        </div>
      )}
      {tx.stage !== "idle" && (
        <div
          className={`notice ${tx.stage === "failed" ? "error" : tx.stage === "done" ? "success" : "info"}`}
          role="status"
        >
          {tx.stage === "wallet" && <>{tx.label}: confirm in your wallet…</>}
          {tx.stage === "mining" && <>{tx.label}: waiting for the block… {txLink(tx.hash)}</>}
          {tx.stage === "done" && <>{tx.label}: confirmed. {txLink(tx.hash)}</>}
          {tx.stage === "failed" && <>{tx.label} failed: {tx.message}</>}
          {(tx.stage === "done" || tx.stage === "failed") && (
            <button className="btn small ghost" onClick={d.dismissTx}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Missing({ d }: DirectionProps) {
  if (d.deployment) {
    return null;
  }
  return (
    <NotDeployed
      chainId={defaultChainId}
      liveOn={d.switchTarget}
      connected={d.wallet.account !== null}
      connecting={d.wallet.connecting}
      onConnect={() => void d.wallet.connect()}
      onSwitchNetwork={d.switchNetwork}
    />
  );
}

export function Bid({ d }: DirectionProps) {
  if (!d.view || !d.snapshot) {
    return null;
  }
  return (
    <BidPanel
      view={d.view}
      position={d.snapshot.position}
      connected={d.wallet.account !== null}
      wrongNetwork={d.wrongNetwork}
      busy={d.busy}
      onConnect={() => void d.wallet.connect()}
      onSwitchNetwork={d.switchNetwork}
      onBid={(amount, minimumTokens) =>
        void d.run("Bid", (auction) =>
          minimumTokens > 0n
            ? auction.contributeWithMinimum(minimumTokens, { value: amount })
            : auction.contribute({ value: amount })
        )
      }
    />
  );
}

export function Position({ d }: DirectionProps) {
  const { snapshot, view, deployment, account } = d;
  if (!snapshot?.position || !view) {
    return null;
  }
  return (
    <PositionPanel
      view={view}
      position={snapshot.position}
      finalPrice={snapshot.finalPrice}
      saleSupply={snapshot.saleSupply}
      busy={d.busy}
      onClaim={() => void d.run("Claim GVRA", (auction) => auction.claimTokens())}
      account={account ?? ""}
      onWithdrawRefund={(recipient) =>
        void d.run("Withdraw refund", (auction) => auction.withdrawRefundTo(recipient))
      }
      onAddToken={() => d.wallet.watchToken(deployment!.token, "GVRA", 18)}
    />
  );
}

export function Settlement({ d }: DirectionProps) {
  const { snapshot, view, account, deployment } = d;
  if (!snapshot || !view) {
    return null;
  }
  return (
    <>
      <SettlementPanel
        snapshot={snapshot}
        view={view}
        isOwner={d.isOwner}
        canTransact={d.canTransact}
        busy={d.busy}
        onStart={() => void d.run("Start auction", (auction) => auction.start())}
        onFinalize={() => void d.run("Finalize", (auction) => auction.finalize())}
        onBurnDust={() => void d.run("Burn dust", (auction) => auction.burnRemainderAfterAllClaimed())}
        onWithdrawProceeds={() =>
          void d.run("Withdraw proceeds", (auction) => auction.withdrawIssuerProceeds(account!))
        }
      />
      {deployment?.chainId === LOCAL_CHAIN_ID && <DevTools onAdvanced={d.refresh} />}
    </>
  );
}

export function Bids({ d }: DirectionProps) {
  const { snapshot, deployment, account, bids, historyUnavailable } = d;
  if (!snapshot) {
    return null;
  }
  return (
    <section className="card bids-card">
      <h2>Bids</h2>
      <BidHistory
        bids={bids}
        saleSupply={snapshot.saleSupply}
        startTime={snapshot.startTime}
        account={account}
        explorer={deployment?.explorer ?? null}
        auction={deployment?.auction ?? null}
        historyUnavailable={historyUnavailable}
      />
    </section>
  );
}

export function Details({ d }: DirectionProps) {
  return d.deployment && d.snapshot ? <SaleInfo deployment={d.deployment} snapshot={d.snapshot} /> : null;
}

export function Footer({ d }: DirectionProps) {
  const { deployment } = d;
  return (
    <footer className="footer">
      <span>DutchPoint, SC4053 Blockchain Technology</span>
      {deployment && (
        <span>
          {chainName(deployment.chainId)} auction{" "}
          {deployment.explorer ? (
            <a href={`${deployment.explorer}/address/${deployment.auction}`} target="_blank" rel="noreferrer">
              {deployment.auction.slice(0, 10)}…
            </a>
          ) : (
            <code>{deployment.auction.slice(0, 10)}…</code>
          )}
        </span>
      )}
    </footer>
  );
}
