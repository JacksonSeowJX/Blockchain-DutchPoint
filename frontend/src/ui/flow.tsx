import { ReactNode, useState } from "react";

import { Faq } from "../components/Faq";
import { HowItWorks } from "../components/HowItWorks";
import { PriceChart } from "../components/PriceChart";
import { Dashboard } from "../hooks/useDashboard";
import { Status } from "../lib/auctionMath";
import { percent } from "../lib/format";
import { Bid, Bids, Details, DirectionProps, Position, Settlement } from "./shared";

export type Panel = "bid" | "position" | "settlement";

/** What this visitor should do next, and which panel lets them do it. */
export function nextStep(d: Dashboard): { title: string; detail: string; panel: Panel } {
  const { view, snapshot, wallet, isOwner } = d;
  const committed = (snapshot?.position?.commitment ?? 0n) > 0n;
  const claimed = snapshot?.position?.claimed ?? false;
  const connected = wallet.account !== null;
  if (!view) return { title: "Loading the sale", detail: "Reading the auction from Sepolia.", panel: "bid" };
  switch (view.status) {
    case Status.Pending:
      return isOwner
        ? { title: "Start the auction", detail: "You're the issuer, so you open the 20-minute window.", panel: "settlement" }
        : { title: "Bidding not open", detail: "You can bid as soon as the issuer starts the sale.", panel: "bid" };
    case Status.Active:
      if (!connected) return { title: "Connect a wallet to bid", detail: "You can look around without connecting.", panel: "bid" };
      if (committed) return { title: "Bid placed", detail: "Wait for the result, or add to your bid.", panel: "bid" };
      return { title: "Pick an amount and bid", detail: "The price only falls from here.", panel: "bid" };
    case Status.Cleared:
      return committed
        ? { title: "Sold out. Your bid is in.", detail: "You can claim your GVRA when the window ends.", panel: "position" }
        : { title: "Sold out", detail: "Bidding is closed.", panel: "bid" };
    case Status.AwaitingFinalization:
      return { title: "Finalize the sale", detail: "Anyone can do this. It sets the final price and opens claims.", panel: "settlement" };
    default:
      if (committed && !claimed) return { title: "Claim your GVRA", detail: "The sale is final, so your tokens are ready.", panel: "position" };
      if (committed) return { title: "Claim complete", detail: "Your GVRA has been claimed.", panel: "position" };
      return { title: "Sale complete", detail: "See the final result under Sale details.", panel: "settlement" };
  }
}

/** The share of supply covered by bids at today's price, from 0 to 100. */
export function covered(d: Dashboard): number {
  const { view, snapshot } = d;
  if (!view || !snapshot) return 0;
  if (view.clearing.cleared) return 100;
  return Math.min(100, percent(snapshot.totalCommitted, view.demandTarget));
}

/** The price the sale clears at if nobody else bids, or null if that falls below the reserve. */
export function impliedClearing(d: Dashboard): bigint | null {
  const { snapshot } = d;
  if (!snapshot || snapshot.totalCommitted === 0n) return null;
  const price = (snapshot.totalCommitted * 10n ** 18n) / snapshot.saleSupply;
  return price < snapshot.reservePrice ? null : price;
}

export function ActionPanel({ d }: DirectionProps) {
  const { panel } = nextStep(d);
  if (panel === "position" && d.snapshot?.position) return <Position d={d} />;
  if (panel === "settlement") return <Settlement d={d} />;
  return <Bid d={d} />;
}

/** Everything secondary, one click away, so the page stays short. */
export function InfoTabs({ d, hidePrice }: DirectionProps & { hidePrice?: boolean }) {
  const { snapshot, view } = d;
  const [active, setActive] = useState("Bids");
  if (!snapshot || !view) return null;
  const { panel } = nextStep(d);
  const showYou = Boolean(snapshot.position) && panel !== "position";
  const tabs: [string, ReactNode][] = [
    ["Bids", <Bids key="b" d={d} />],
    ...(hidePrice ? [] : ([["Price", <section className="card" key="p"><h2>Price</h2><PriceChart state={snapshot} view={view} /></section>]] as [string, ReactNode][])),
    ...(showYou ? ([["Your bid", <Position key="y" d={d} />]] as [string, ReactNode][]) : []),
    ["Sale details", <div className="tab-two" key="s">{panel !== "settlement" && <Settlement d={d} />}<Details d={d} /></div>],
    ["How it works", <div className="tab-two" key="h"><HowItWorks /><Faq /></div>]
  ];
  const shown = tabs.find(([name]) => name === active) ?? tabs[0];
  return (
    <section className="info" aria-label="More about this sale">
      <div className="tabs" role="tablist">
        {tabs.map(([name]) => (
          <button key={name} role="tab" aria-selected={shown[0] === name} onClick={() => setActive(name)}>{name}</button>
        ))}
      </div>
      <div role="tabpanel" className="tab-body">{shown[1]}</div>
    </section>
  );
}
