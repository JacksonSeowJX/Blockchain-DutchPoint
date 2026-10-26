import { fireEvent, render, screen } from "@testing-library/react";
import { parseEther } from "ethers";
import { describe, expect, it, vi } from "vitest";

import { View } from "../lib/auctionMath";
import { position, viewAfter } from "../test/fixtures";
import { BidPanel } from "./BidPanel";

function renderPanel(view: View = viewAfter(700n, { totalCommitted: parseEther("10") })) {
  const onBid = vi.fn();
  render(
    <BidPanel
      view={view}
      position={position()}
      connected
      wrongNetwork={null}
      busy={false}
      onConnect={vi.fn()}
      onSwitchNetwork={vi.fn()}
      onBid={onBid}
    />
  );
  return onBid;
}

const bidButton = () => screen.getByRole("button", { name: /^Bid / }) as HTMLButtonElement;

describe("BidPanel", () => {
  // Codex audit finding A1: before a bid is mined, the falling price can shrink the remaining room, so
  // only part of the bid may be accepted. The quoted minimum is therefore sent with the bid, and the
  // contract cancels the bid rather than fill it below that minimum.
  it("A1: sends the quoted minimum with the bid, for the contract to enforce", () => {
    const onBid = renderPanel();
    expect(screen.getByText("This bid buys at least")).toBeTruthy();
    expect(screen.getByText(/cancelled/i)).toBeTruthy();

    fireEvent.click(bidButton());
    // 1 ETH at 0.01125 ETH buys 88.89 GVRA; the minimum allows 1% for the time the bid takes to be mined.
    expect(onBid).toHaveBeenCalledWith(parseEther("1"), (88_888888888888888888n * 9_900n) / 10_000n);
  });

  it("A1: sends a sell-out bid without a minimum, because it buys whatever is left", () => {
    const onBid = renderPanel();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "5" } });
    expect(screen.queryByText("This bid buys at least")).toBeNull();
    expect(screen.getByText(/whatever is left/i)).toBeTruthy();

    fireEvent.click(bidButton());
    expect(onBid).toHaveBeenCalledWith(parseEther("5"), 0n);
  });

  // Independent review (Alfred) finding C02: the sell-out shortcut truncated the room left to 6 decimals, so the
  // amount fell just short of selling out, and with bid protection it was also sent with a minimum.
  it("B1: the sell-out shortcut rounds up, so the bid sells out and carries no minimum", () => {
    // 1.126543211 ETH of room left at t = 700s.
    const onBid = renderPanel(viewAfter(700n, { totalCommitted: parseEther("10.123456789") }));
    fireEvent.click(screen.getByRole("button", { name: "Sell-out amount" }));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("1.126544");

    fireEvent.click(bidButton());
    expect(onBid).toHaveBeenCalledWith(parseEther("1.126544"), 0n);
  });

  // Codex audit finding A4: a negative amount must be rejected, not offered as a bid.
  it("A4: rejects a negative amount and keeps the bid button disabled", () => {
    const onBid = renderPanel();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "-1" } });

    expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
    expect(bidButton().disabled).toBe(true);
    fireEvent.click(bidButton());
    expect(onBid).not.toHaveBeenCalled();
  });

  it("A4: still accepts a normal positive amount", () => {
    const onBid = renderPanel();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "0.5" } });

    expect(bidButton().disabled).toBe(false);
    fireEvent.click(bidButton());
    expect(onBid).toHaveBeenCalledWith(parseEther("0.5"), (44_444444444444444444n * 9_900n) / 10_000n);
  });
});
