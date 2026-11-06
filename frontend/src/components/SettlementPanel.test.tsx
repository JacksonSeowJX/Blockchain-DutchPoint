import { render, screen } from "@testing-library/react";
import { parseEther, parseUnits } from "ethers";
import { describe, expect, it, vi } from "vitest";

import { Snapshot } from "../hooks/useAuction";
import { auctionState, viewAfter } from "../test/fixtures";
import { SettlementPanel } from "./SettlementPanel";

/** The 6 Nov Sepolia sale after its three claims, which left `dust` units of GVRA in the auction. */
function finishedSale(dust: bigint): Snapshot {
  const sale = {
    startPrice: parseEther("0.0001"),
    reservePrice: parseEther("0.00002"),
    cleared: true,
    finalized: true,
    finalPrice: parseEther("0.0000576"),
    totalCommitted: parseEther("0.0576")
  };
  return {
    ...auctionState(sale),
    tokenName: "Gavora",
    tokenSymbol: "GVRA",
    owner: "0x5D2EB775B96Ff879AE8Caa427Ef8D66BCB301010",
    totalTokensSold: parseUnits("1000", 18),
    totalTokensClaimed: parseUnits("1000", 18) - dust,
    burnedUnsold: 0n,
    participantCount: 3n,
    claimedParticipantCount: 3n,
    refundLiability: 0n,
    issuerProceedsWithdrawn: parseEther("0.0576"),
    auctionTokenBalance: dust,
    blockNumber: 1,
    blockTimestamp: 1_002_000n,
    loadedAt: 0,
    position: null
  };
}

function renderPanel(dust: bigint) {
  const snapshot = finishedSale(dust);
  render(
    <SettlementPanel
      snapshot={snapshot}
      view={viewAfter(1_300n, snapshot)}
      isOwner={false}
      canTransact
      busy={false}
      onStart={vi.fn()}
      onFinalize={vi.fn()}
      onBurnDust={vi.fn()}
      onWithdrawProceeds={vi.fn()}
    />
  );
}

// Finding D4: the 6 Nov sale's claims left one unit of GVRA, and the button read "Burn 1 units".
describe("SettlementPanel rounding dust", () => {
  it("D4: names a single unit in the singular", () => {
    renderPanel(1n);
    expect(screen.getByRole("button", { name: "Burn 1 unit of rounding dust" })).toBeTruthy();
  });

  it("D4: keeps the plural for more than one unit", () => {
    renderPanel(3n);
    expect(screen.getByRole("button", { name: "Burn 3 units of rounding dust" })).toBeTruthy();
  });

  it("D3: shows the final clearing price in full", () => {
    renderPanel(1n);
    expect(screen.getByText("0.0000576 ETH")).toBeTruthy();
  });
});
