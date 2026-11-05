import { render, screen, within } from "@testing-library/react";
import { parseEther, parseUnits } from "ethers";
import { describe, expect, it } from "vitest";

import { Bid } from "../hooks/useAuction";
import { BidHistory } from "./BidHistory";

const ALICE = "0x00000000000000000000000000000000000000A1";
const BOB = "0x00000000000000000000000000000000000000B2";
const AUCTION = "0x713e80Bea173f595b191ce635fa7dB45395cB1Eb";

function bid(overrides: Partial<Bid> & Pick<Bid, "key" | "account" | "amount" | "accepted">): Bid {
  return {
    txHash: `0x${"0".repeat(63)}1`,
    blockNumber: 10,
    timestamp: 1_000_060n,
    price: parseEther("0.0125"),
    totalCommitted: parseEther("12.5"),
    surplusCredited: false,
    ...overrides
  };
}

describe("BidHistory", () => {
  // Codex audit finding A5: "Refunded" was shown even when the surplus was only credited.
  it("A5: distinguishes a surplus paid back from one held as a credit", () => {
    render(
      <BidHistory
        bids={[
          bid({ key: "paid", account: ALICE, amount: parseEther("2"), accepted: parseEther("1.5") }),
          bid({
            key: "held",
            account: BOB,
            amount: parseEther("1"),
            accepted: parseEther("0.25"),
            surplusCredited: true
          })
        ]}
        saleSupply={parseUnits("1000", 18)}
        startTime={1_000_000n}
        account={null}
        explorer={null}
        auction={AUCTION}
        historyUnavailable={false}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Surplus" })).toBeTruthy();
    const rows = screen.getAllByRole("row");
    const aliceRow = rows.find((row) => row.textContent?.includes("0x0000…00A1"))!;
    const bobRow = rows.find((row) => row.textContent?.includes("0x0000…00B2"))!;
    expect(within(aliceRow).getByText(/returned/)).toBeTruthy();
    expect(within(bobRow).getByText(/held/)).toBeTruthy();
    expect(within(bobRow).queryByText(/returned/)).toBeNull();
  });

  // Finding D1: with no history to read, the panel claimed there were no bids.
  it("D1: says the history could not be loaded, and links to the bids on the explorer", () => {
    render(
      <BidHistory
        bids={[]}
        saleSupply={parseUnits("1000", 18)}
        startTime={1_000_000n}
        account={null}
        explorer="https://sepolia.etherscan.io"
        auction={AUCTION}
        historyUnavailable
      />
    );

    expect(screen.queryByText(/No bids yet/)).toBeNull();
    expect(screen.getByText(/couldn't be loaded/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Etherscan/ }).getAttribute("href")).toBe(
      `https://sepolia.etherscan.io/address/${AUCTION}`
    );
  });
});
