import { parseEther, parseUnits } from "ethers";

import { AuctionState, View, viewAt } from "../lib/auctionMath";
import { Position } from "../hooks/useAuction";

/** The default local sale: 1,000 GVRA, price falling from 0.02 to 0.005 ETH over 20 minutes. */
export function auctionState(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    saleSupply: parseUnits("1000", 18),
    startPrice: parseEther("0.02"),
    reservePrice: parseEther("0.005"),
    started: true,
    finalized: false,
    cleared: false,
    startTime: 1_000_000n,
    lastCommitmentTimestamp: 1_000_000n,
    clearingTime: 0n,
    clearingPrice: 0n,
    finalPrice: 0n,
    totalCommitted: 0n,
    ...overrides
  };
}

/** The dashboard view `seconds` into the auction. */
export function viewAfter(seconds: bigint, overrides: Partial<AuctionState> = {}): View {
  const state = auctionState(overrides);
  return viewAt(state, state.startTime + seconds);
}

export function position(overrides: Partial<Position> = {}): Position {
  return {
    commitment: 0n,
    claimed: false,
    tokensClaimed: 0n,
    refundCredit: 0n,
    tokenBalance: 0n,
    ethBalance: parseEther("100"),
    ...overrides
  };
}
