import "@fontsource/instrument-serif/400.css";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "./base.css";
import "./immersive.css";
import "./terrain.css";

import { DemandMeter } from "../components/DemandMeter";
import { Header } from "../components/Header";
import { STATUS_LABELS, Status } from "../lib/auctionMath";
import { ActionPanel, InfoTabs, covered, nextStep } from "./flow";
import { DirectionProps, Footer, Missing, Notices, Summary, countdown, priceFigure } from "./shared";
import { Surface } from "./Surface";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => [0, 1, 2, 3, 4].filter((col) => col >= row).map((col) => (
        <circle key={`${row}${col}`} cx={6 + col * 5} cy={6 + row * 5} r="1.7" fill="var(--accent)" />
      )))}
    </svg>
  );
}

export function Layout({ d }: DirectionProps) {
  const { snapshot, view, wallet, supported, bids } = d;
  const step = nextStep(d);
  const time = view ? countdown(view) : null;
  const stopped = view ? view.clearing.cleared || view.status === Status.Finalized : false;
  const start = Number(snapshot?.startTime ?? 0n);
  const now = !view || !snapshot?.started ? 0 : view.clearing.cleared ? (Number(view.clearing.time) - start) / 1200 : Number(view.elapsedSeconds) / 1200;
  const biggest = Math.max(0.0001, ...bids.map((bid) => Number(bid.accepted)));
  const ridges = bids.map((bid) => ({ at: (Number(bid.timestamp) - start) / 1200, size: 0.25 + 0.65 * (Number(bid.accepted) / biggest) }));

  return (
    <div>
      <section className="terrain">
        {view && <Surface now={now} ridges={ridges} stopped={stopped} />}
        <div className="terrain-ui">
          <Header wallet={wallet} supported={supported} mark={<Mark />} />
          <Notices d={d} />
          <Missing d={d} />
          <div className="terrain-grid">
            <div className="tcopy">
              <h1>{snapshot?.tokenName ?? "Gavora"} token sale</h1>
              <p className="sub">A 20-minute Dutch auction. The price falls until bids cover the supply, then everyone pays one price.</p>
              {view && time && snapshot && (
                <dl className="readout">
                  <div><dt>Price</dt><dd>{priceFigure(view.price, view.status === Status.Active)} <small>ETH</small></dd></div>
                  <div><dt>{time.caption[0].toUpperCase() + time.caption.slice(1)}</dt><dd>{time.clock}</dd></div>
                  <div><dt>Covered</dt><dd>{covered(d).toFixed(1)}%</dd></div>
                  <div><dt>Stage</dt><dd>{STATUS_LABELS[view.status]}</dd></div>
                </dl>
              )}
            </div>
            <div className="ticket">
              <p className="step"><strong>{step.title}</strong> {step.detail}</p>
              <ActionPanel d={d} />
              {snapshot && view && <DemandMeter view={view} totalCommitted={snapshot.totalCommitted} />}
            </div>
          </div>
          <p className="key">Left to right is the 20 minutes. Each ridge is a bid, and the white line is now.</p>
        </div>
      </section>
      <main className="lower">
        <Summary d={d} />
        <InfoTabs d={d} />
        <Footer d={d} />
      </main>
    </div>
  );
}
