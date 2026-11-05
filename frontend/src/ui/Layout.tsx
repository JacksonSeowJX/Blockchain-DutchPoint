import "@fontsource/doto/800.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/600.css";
import "./base.css";
import "./immersive.css";
import "./shaft.css";

import { useEffect, useRef, useState } from "react";

import { DemandMeter } from "../components/DemandMeter";
import { Faq } from "../components/Faq";
import { Header } from "../components/Header";
import { HowItWorks } from "../components/HowItWorks";
import { PriceChart } from "../components/PriceChart";
import { STATUS_LABELS, Status } from "../lib/auctionMath";
import { Bid, Bids, Details, DirectionProps, Footer, Missing, Notices, Position, Settlement, countdown, priceFigure } from "./shared";
import { Tunnel } from "./Tunnel";


function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {[13, 8.5, 4].map((r, i) => (
        <circle key={r} cx="16" cy="16" r={r} fill="none" stroke={["#ff2d3f", "#b58bff", "#2bd4ff"][i]} strokeWidth="2" strokeDasharray="1.5 2" />
      ))}
    </svg>
  );
}

const CHAPTERS = [
  { title: "You're at the live minute", body: "Each ring is one minute of the 20-minute sale. Red rings are the high prices, blue the low ones. Rings behind you are spent." },
  { title: "The price falls ring by ring", body: "It drops in a straight line to the reserve. There's no rush to bid first: the same ETH buys more GVRA as it falls." },
  { title: "Bids pile up", body: "Brighter dashed rings mark minutes with bids. The moment committed ETH can buy the whole supply, the auction sells out." },
  { title: "Everyone pays one price", body: "Every winner pays the same clearing price, however early they bid. Any surplus comes straight back, and unsold GVRA is burned." }
];

export function Layout({ d }: DirectionProps) {
  const { snapshot, view, wallet, theme, supported, bids } = d;
  const pin = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const box = pin.current?.getBoundingClientRect();
      if (!box) return;
      const room = box.height - window.innerHeight;
      progress.current = room <= 0 ? 0 : Math.min(1, Math.max(0, -box.top / room));
      setChapter(Math.min(CHAPTERS.length - 1, Math.floor(progress.current * CHAPTERS.length)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stopped = view ? view.clearing.cleared || view.status === Status.Finalized : false;
  const start = snapshot?.startTime ?? 0n;
  const minute = !view ? 0 : view.clearing.cleared ? Number(view.clearing.time - start) / 60 : Number(view.elapsedSeconds) / 60;
  const bidMinutes = bids.map((bid) => Math.floor(Number(bid.timestamp - start) / 60));
  const time = view ? countdown(view) : null;

  return (
    <div>
      <div className="pin" ref={pin}>
        <section className="shaft">
          {view && <Tunnel minute={minute} bidMinutes={bidMinutes} stopped={stopped} travel={() => progress.current} />}
          <div className="shaft-ui">
            <Header wallet={wallet} supported={supported} theme={theme.theme} onCycleTheme={theme.cycle} mark={<Mark />} />
            <Notices d={d} />
            <Missing d={d} />
            <div className="shaft-grid">
              <div className="shaft-read">
                <h1>{snapshot?.tokenName ?? "Gavora"} {snapshot?.tokenSymbol ?? "GVRA"}</h1>
                {view && time && (
                  <>
                    <p className="led">{priceFigure(view.price, view.status === Status.Active)}</p>
                    <p className="sub">ETH per GVRA. {STATUS_LABELS[view.status]}, {time.clock} {time.caption}.</p>
                  </>
                )}
                <div className="chapter" key={chapter}>
                  <h2>{CHAPTERS[chapter].title}</h2>
                  <p>{CHAPTERS[chapter].body}</p>
                </div>
              </div>
              <div className="ticket"><Bid d={d} /></div>
            </div>
          </div>
        </section>
      </div>
      <main className="lower">
        {snapshot && view && <DemandMeter view={view} totalCommitted={snapshot.totalCommitted} />}
        {snapshot && view && (
          <section className="card price-card">
            <h2>Price</h2>
            <PriceChart state={snapshot} view={view} />
          </section>
        )}
        {snapshot && (
          <div className="split">
            <Bids d={d} />
            <div className="stack"><Position d={d} /><Settlement d={d} /><Details d={d} /></div>
          </div>
        )}
        <div className="how-fallback"><HowItWorks /></div>
        <Faq />
        <Footer d={d} />
      </main>
    </div>
  );
}
