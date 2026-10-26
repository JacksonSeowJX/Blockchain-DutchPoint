import { Contract, EventLog, Provider } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuctionState } from "../lib/auctionMath";
import { Deployment, LOCAL_CHAIN_ID, auctionAbi, chainName, tokenAbi } from "../lib/contracts";
import { describeError, isConnectionError } from "../lib/errors";

export type Position = {
  commitment: bigint;
  claimed: boolean;
  tokensClaimed: bigint;
  refundCredit: bigint;
  tokenBalance: bigint;
  ethBalance: bigint;
};

export type Snapshot = AuctionState & {
  tokenName: string;
  tokenSymbol: string;
  owner: string;
  totalTokensSold: bigint;
  totalTokensClaimed: bigint;
  burnedUnsold: bigint;
  participantCount: bigint;
  claimedParticipantCount: bigint;
  refundLiability: bigint;
  issuerProceedsWithdrawn: bigint;
  auctionTokenBalance: bigint;
  blockNumber: number;
  blockTimestamp: bigint;
  /** Wall-clock time the snapshot was read, used to extrapolate the chain clock. */
  loadedAt: number;
  position: Position | null;
};

export type Bid = {
  key: string;
  txHash: string;
  blockNumber: number;
  timestamp: bigint;
  account: string;
  amount: bigint;
  accepted: bigint;
  price: bigint;
  totalCommitted: bigint;
  /** The bidder's wallet rejected the surplus refund, so it is held in the auction for withdrawal. */
  surplusCredited: boolean;
};

export type AuctionData = {
  snapshot: Snapshot | null;
  bids: Bid[];
  error: string;
  /** The last read failed because the RPC could not be reached; it is retried on every refresh. */
  offline: boolean;
  refresh: () => Promise<void>;
};

const FALLBACK_REFRESH_MS = 15_000;
// Public RPCs cap the block range of one eth_getLogs call (PublicNode's keyless Sepolia RPC allows
// 50,000 blocks, about a week), so the bid history is scanned in chunks.
const LOG_CHUNK_BLOCKS = 10_000;

export function useAuction(
  provider: Provider | null,
  deployment: Deployment | null,
  account: string | null
): AuctionData {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  const lastBidBlock = useRef(-1);
  const blockTimes = useRef(new Map<number, bigint>());
  const inFlight = useRef(false);
  const queued = useRef(false);
  // Each provider/deployment pair is one read context. A read started under an older context finishes
  // without touching state, so switching network can never mix two chains' data.
  const context = useRef(0);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const deploymentRef = useRef(deployment);

  const contracts = useMemo(() => {
    if (!provider || !deployment) {
      return null;
    }
    return {
      auction: new Contract(deployment.auction, auctionAbi, provider),
      token: new Contract(deployment.token, tokenAbi, provider)
    };
  }, [provider, deployment]);

  useEffect(() => {
    context.current += 1;
    setSnapshot(null);
    setBids([]);
    setError("");
    setOffline(false);
    lastBidBlock.current = -1;
    // A new map rather than clear(): a read from the old context keeps writing into its own map.
    blockTimes.current = new Map();
  }, [contracts]);

  const blockTime = useCallback(
    async (cache: Map<number, bigint>, blockNumber: number) => {
      const cached = cache.get(blockNumber);
      if (cached !== undefined) {
        return cached;
      }
      const block = await provider!.getBlock(blockNumber);
      const timestamp = BigInt(block?.timestamp ?? 0);
      cache.set(blockNumber, timestamp);
      return timestamp;
    },
    [provider]
  );

  const load = useCallback(async () => {
    if (!contracts || !provider || !deployment) {
      return;
    }
    const { auction, token } = contracts;
    const auctionAddress = deployment.auction;
    const id = context.current;
    const stale = () => id !== context.current;
    const times = blockTimes.current;

    const code = await provider.getCode(auctionAddress);
    if (stale()) {
      return;
    }
    if (code === "0x") {
      setError(
        deployment.chainId === LOCAL_CHAIN_ID
          ? "No DutchPoint auction is deployed on the local node. Run `npm run deploy:local`."
          : `No DutchPoint auction found at ${auctionAddress} on this network.`
      );
      setSnapshot(null);
      return;
    }

    const [block, core, accounting, position] = await Promise.all([
      provider.getBlock("latest"),
      Promise.all([
        token.name(),
        token.symbol(),
        auction.owner(),
        auction.saleSupply(),
        auction.startPrice(),
        auction.reservePrice(),
        auction.started(),
        auction.finalized(),
        auction.cleared(),
        auction.startTime(),
        auction.lastCommitmentTimestamp(),
        auction.clearingTime(),
        auction.clearingPrice(),
        auction.finalPrice(),
        auction.totalCommitted()
      ]),
      Promise.all([
        auction.totalTokensSold(),
        auction.totalTokensClaimed(),
        auction.burnedUnsold(),
        auction.participantCount(),
        auction.claimedParticipantCount(),
        auction.refundLiability(),
        auction.issuerProceedsWithdrawn(),
        token.balanceOf(auctionAddress)
      ]),
      account
        ? Promise.all([
            auction.commitments(account),
            auction.claimed(account),
            auction.tokensClaimed(account),
            auction.refundCredits(account),
            token.balanceOf(account),
            provider.getBalance(account)
          ])
        : Promise.resolve(null)
    ]);
    if (stale()) {
      return;
    }

    const [
      tokenName,
      tokenSymbol,
      owner,
      saleSupply,
      startPrice,
      reservePrice,
      started,
      finalized,
      cleared,
      startTime,
      lastCommitmentTimestamp,
      clearingTime,
      clearingPrice,
      finalPrice,
      totalCommitted
    ] = core;
    const [
      totalTokensSold,
      totalTokensClaimed,
      burnedUnsold,
      participantCount,
      claimedParticipantCount,
      refundLiability,
      issuerProceedsWithdrawn,
      auctionTokenBalance
    ] = accounting;

    setSnapshot({
      tokenName,
      tokenSymbol,
      owner,
      saleSupply,
      startPrice,
      reservePrice,
      started,
      finalized,
      cleared,
      startTime,
      lastCommitmentTimestamp,
      clearingTime,
      clearingPrice,
      finalPrice,
      totalCommitted,
      totalTokensSold,
      totalTokensClaimed,
      burnedUnsold,
      participantCount,
      claimedParticipantCount,
      refundLiability,
      issuerProceedsWithdrawn,
      auctionTokenBalance,
      blockNumber: block?.number ?? 0,
      blockTimestamp: BigInt(block?.timestamp ?? 0),
      loadedAt: Date.now(),
      position: position
        ? {
            commitment: position[0],
            claimed: position[1],
            tokensClaimed: position[2],
            refundCredit: position[3],
            tokenBalance: position[4],
            ethBalance: position[5]
          }
        : null
    });

    // Bid history: fetch only blocks we have not scanned yet, one chunk at a time.
    const latest = block?.number ?? 0;
    let from = Math.max(deployment.deployedAtBlock, lastBidBlock.current + 1);
    while (from <= latest) {
      const to = Math.min(latest, from + LOG_CHUNK_BLOCKS - 1);
      const [logs, credits] = await Promise.all([
        auction.queryFilter(auction.filters.ContributionReceived(), from, to),
        auction.queryFilter(auction.filters.RefundCredited(), from, to)
      ]);
      // A surplus the bidder's wallet rejected is credited instead of paid; match it to its bid.
      const creditedKey = (txHash: string, account: string) => `${txHash}-${account.toLowerCase()}`;
      const credited = new Set(
        credits
          .filter((log): log is EventLog => log instanceof EventLog)
          .map((log) => creditedKey(log.transactionHash, log.args.account as string))
      );
      const fresh: Bid[] = [];
      for (const log of logs) {
        if (!(log instanceof EventLog)) {
          continue;
        }
        const account = log.args.account as string;
        fresh.push({
          key: `${log.transactionHash}-${log.index}`,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: await blockTime(times, log.blockNumber),
          account,
          amount: log.args.amount as bigint,
          accepted: log.args.accepted as bigint,
          price: log.args.price as bigint,
          totalCommitted: log.args.totalCommitted as bigint,
          surplusCredited: credited.has(creditedKey(log.transactionHash, account))
        });
      }
      if (stale()) {
        return;
      }
      // Recorded per chunk, so a failed request resumes here instead of rescanning from the start.
      lastBidBlock.current = to;
      if (fresh.length > 0) {
        setBids((previous) => [...previous, ...fresh]);
      }
      from = to + 1;
    }
    if (stale()) {
      return;
    }
    setError("");
    setOffline(false);
  }, [contracts, provider, deployment, account, blockTime]);

  // Declared before the subscription effect below, so the first refresh already sees the latest load.
  useEffect(() => {
    loadRef.current = load;
    deploymentRef.current = deployment;
  }, [load, deployment]);

  /**
   * Serialises refreshes: block events can arrive while a read is still running. A queued refresh runs
   * the latest context's read, not the one that was in flight when it was queued.
   */
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        queued.current = false;
        const id = context.current;
        const chainId = deploymentRef.current?.chainId ?? 0;
        try {
          await loadRef.current();
        } catch (err) {
          if (id !== context.current) {
            continue; // an error from an outdated read says nothing about the current network
          }
          const unreachable = isConnectionError(err);
          setOffline(unreachable);
          if (!unreachable) {
            setError(describeError(err));
          } else if (chainId === LOCAL_CHAIN_ID) {
            setError("Can't reach the local Hardhat node at 127.0.0.1:8545. Start it with `npm run node`.");
          } else {
            setError(
              `Can't reach the ${chainName(chainId)} network right now. ` +
                "Check your internet connection; DutchPoint keeps retrying in the background."
            );
          }
        }
      } while (queued.current);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!provider || !contracts) {
      return;
    }
    void refresh();
    const onBlock = () => {
      void refresh();
    };
    void provider.on("block", onBlock);
    const id = window.setInterval(onBlock, FALLBACK_REFRESH_MS);
    return () => {
      void provider.off("block", onBlock);
      window.clearInterval(id);
    };
  }, [provider, contracts, refresh]);

  return { snapshot, bids, error, offline, refresh };
}
