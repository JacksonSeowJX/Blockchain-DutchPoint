import { fireEvent, render, screen } from "@testing-library/react";
import { parseEther } from "ethers";
import { describe, expect, it, vi } from "vitest";

import { position, viewAfter } from "../test/fixtures";
import { BidPanel } from "./BidPanel";

function renderPanel() {
  const onBid = vi.fn();
  render(
    <BidPanel
      view={viewAfter(700n, { totalCommitted: parseEther("10") })}
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
  // only part of the bid may be accepted. The quote is a minimum only if the whole bid is accepted.
  it("A1: presents the quote as conditional on the whole bid being accepted", () => {
    renderPanel();
    expect(screen.getByText("If fully accepted, at least")).toBeTruthy();
    expect(screen.queryByText("You receive at least")).toBeNull();
    expect(screen.getByText(/only part of it is accepted/i)).toBeTruthy();
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
    expect(onBid).toHaveBeenCalledWith(parseEther("0.5"));
  });
});
