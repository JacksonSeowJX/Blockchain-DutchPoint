import { act, renderHook, waitFor } from "@testing-library/react";
import { getAddress, parseEther } from "ethers";
import { describe, expect, it } from "vitest";

import { fakeChain, txHash } from "../test/fakeChain";
import { useAuction } from "./useAuction";

// Checksummed, as ethers returns addresses decoded from event logs.
const BIDDER_ON_SEPOLIA = getAddress("0x00000000000000000000000000000000000000a1");
const BIDDER_ON_LOCAL = getAddress("0x00000000000000000000000000000000000000b2");
const price = parseEther("0.0125");

describe("useAuction", () => {
  // Codex audit finding A2: a read that is still running when the network changes must not leak into
  // the new network's view, and the queued refresh must read the new network.
  it("A2: discards a stale read from the previous network and loads the new one", async () => {
    const sepolia = fakeChain({
      chainId: 11155111,
      auction: "0x000000000000000000000000000000000000a00a",
      token: "0x000000000000000000000000000000000000a00b",
      latestBlock: 12_000_000,
      deployedAtBlock: 11_999_000,
      delayFirstBlockRead: true,
      events: [
        {
          name: "ContributionReceived",
          args: [BIDDER_ON_SEPOLIA, parseEther("1"), parseEther("1"), price, parseEther("1")],
          blockNumber: 11_999_500,
          txHash: txHash(1)
        }
      ]
    });
    const local = fakeChain({
      chainId: 31337,
      auction: "0x000000000000000000000000000000000000b00a",
      token: "0x000000000000000000000000000000000000b00b",
      latestBlock: 100,
      deployedAtBlock: 1,
      events: [
        {
          name: "ContributionReceived",
          args: [BIDDER_ON_LOCAL, parseEther("2"), parseEther("2"), price, parseEther("2")],
          blockNumber: 50,
          txHash: txHash(2)
        }
      ]
    });

    const { result, rerender } = renderHook(({ chain }) => useAuction(chain.provider, chain.deployment, null), {
      initialProps: { chain: sepolia }
    });

    // The Sepolia read is now waiting on its "latest block" call. Switch to the local chain.
    rerender({ chain: local });
    // The old read completes after the switch.
    await act(async () => {
      sepolia.releaseFirstBlockRead();
    });

    await waitFor(() => expect(result.current.snapshot?.blockNumber).toBe(100));
    await waitFor(() => expect(result.current.bids.map((bid) => bid.account)).toEqual([BIDDER_ON_LOCAL]));
    expect(local.logQueries.length).toBeGreaterThan(0);
  });

  // Codex audit finding A5: a surplus that the bidder's wallet rejected is only credited, not paid.
  it("A5: marks a surplus as held when the refund was credited instead of paid", async () => {
    const auction = "0x000000000000000000000000000000000000c00a";
    const chain = fakeChain({
      chainId: 31337,
      auction,
      token: "0x000000000000000000000000000000000000c00b",
      latestBlock: 100,
      deployedAtBlock: 1,
      events: [
        {
          name: "ContributionReceived",
          args: [BIDDER_ON_LOCAL, parseEther("1"), parseEther("0.25"), price, parseEther("12.5")],
          blockNumber: 60,
          txHash: txHash(3)
        },
        { name: "RefundCredited", args: [BIDDER_ON_LOCAL, parseEther("0.75")], blockNumber: 60, txHash: txHash(3) },
        {
          name: "ContributionReceived",
          args: [BIDDER_ON_SEPOLIA, parseEther("2"), parseEther("1.5"), price, parseEther("11")],
          blockNumber: 55,
          txHash: txHash(4)
        },
        { name: "SurplusRefunded", args: [BIDDER_ON_SEPOLIA, parseEther("0.5")], blockNumber: 55, txHash: txHash(4) }
      ]
    });

    const { result } = renderHook(() => useAuction(chain.provider, chain.deployment, null));

    await waitFor(() => expect(result.current.bids).toHaveLength(2));
    const byAccount = Object.fromEntries(result.current.bids.map((bid) => [bid.account, bid]));
    expect(byAccount[BIDDER_ON_LOCAL].surplusCredited).toBe(true);
    expect(byAccount[BIDDER_ON_SEPOLIA].surplusCredited).toBe(false);
  });
});
