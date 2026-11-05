import { Contract, EventLog, Provider, Result } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuctionState } from "../lib/auctionMath";
import { Deployment, LOCAL_CHAIN_ID, LOGS_APIS, auctionAbi, chainName, tokenAbi } from "../lib/contracts";
import { describeError, isConnectionError } from "../lib/errors";
import { ExplorerRateLimitError, explorerLogs } from "../lib/explorerLogs";

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
  /** Some of the bid history could not be read from any source; it is retried on every refresh. */
  historyUnavailable: boolean;
  refresh: () => Promise<void>;
};

const FALLBACK_REFRESH_MS = 15_000;
// Public RPCs cap the block range of one eth_getLogs call (PublicNode's keyless Sepolia RPC allows
// 50,000 blocks, about a week), so the bid history is scanned in chunks. They also drop old logs, so
// a chunk the RPC refuses is read from the chain's explorer (LOGS_APIS) instead.
const LOG_CHUNK_BLOCKS = 10_000;
// Blocks at the head of the chain that the explorer may not have indexed yet (about 20 minutes on Sepolia).
const EXPLORER_LAG_BLOCKS = 100;
// Blockscout's keyless API allows about 10 requests an hour from one address. After a failed request the
// explorer is left alone for a minute, or until a rate limit resets (at most an hour).
const EXPLORER_RETRY_MS = 60_000;
const EXPLORER_MAX_WAIT_MS = 3_600_000;

/** A bid or refund-credit event, from either the RPC or the explorer. */
type BidLog = { txHash: string; index: number; blockNumber: number; args: Result; timestamp: bigint | null };

/** Builds bids from ContributionReceived logs, using the RefundCredited logs to mark held surpluses. */
async function toBids(
  contributions: BidLog[],
  credits: BidLog[],
  timeOf: (blockNumber: number) => Promise<bigint>
): Promise<Bid[]> {
  // A surplus the bidder's wallet rejected is credited instead of paid; match it to its bid.
  const creditedKey = (txHash: string, account: string) => `${txHash}-${account.toLowerCase()}`;
  const credited = new Set(credits.map((log) => creditedKey(log.txHash, log.args.account as string)));
  const bids: Bid[] = [];
  for (const log of contributions) {
    const account = log.args.account as string;
    bids.push({
      key: `${log.txHash}-${log.index}`,
      txHash: log.txHash,
      blockNumber: log.blockNumber,
      timestamp: log.timestamp ?? (await timeOf(log.blockNumber)),
      account,
      amount: log.args.amount as bigint,
      accepted: log.args.accepted as bigint,
      price: log.args.price as bigint,
      totalCommitted: log.args.totalCommitted as bigint,
      surplusCredited: credited.has(creditedKey(log.txHash, account))
    });
  }
  return bids;
}

async function rpcBidLogs(auction: Contract, from: number, to: number): Promise<[BidLog[], BidLog[]]> {
  const [contributions, credits] = await Promise.all([
    auction.queryFilter(auction.filters.ContributionReceived(), from, to),
    auction.queryFilter(auction.filters.RefundCredited(), from, to)
  ]);
  const toBidLog = (log: EventLog): BidLog => ({
    txHash: log.transactionHash,
    index: log.index,
    blockNumber: log.blockNumber,
    args: log.args,
    timestamp: null
  });
  const decoded = (logs: unknown[]) => logs.filter((log): log is EventLog => log instanceof EventLog).map(toBidLog);
  return [decoded(contributions), decoded(credits)];
}

async function explorerBidLogs(api: string, auction: Contract, from: number, to: number): Promise<[BidLog[], BidLog[]]> {
  // One request for all of the auction's events, sorted here.
  const logs = await explorerLogs(api, auction.interface, await auction.getAddress(), from, to);
  return [logs.filter((log) => log.name === "ContributionReceived"), logs.filter((log) => log.name === "RefundCredited")];
}

/**
 * The bid history of blocks old enough not to change, kept in the browser for chains whose public RPC
 * drops old logs (those with a LOGS_APIS entry), so a reload reads only newer blocks. Not for the local
 * node: it reuses the same addresses after every restart.
 */
type KeptHistory = { scannedTo: number; bids: Bid[] };

const historyKey = (deployment: Deployment) =>
  `dutchpoint:bids:v1:${deployment.chainId}:${deployment.auction.toLowerCase()}`;

function readKeptHistory(deployment: Deployment): KeptHistory | null {
  if (!LOGS_APIS[deployment.chainId]) {
    return null;
  }
  try {
    const kept = JSON.parse(localStorage.getItem(historyKey(deployment)) ?? "null") as {
      scannedTo: number;
      bids: Record<keyof Bid, string | number | boolean>[];
    } | null;
    if (!kept || !Number.isInteger(kept.scannedTo) || !Array.isArray(kept.bids)) {
      return null;
    }
    const bids = kept.bids.map((bid) => ({
      key: String(bid.key),
      txHash: String(bid.txHash),
      blockNumber: Number(bid.blockNumber),
      timestamp: BigInt(bid.timestamp as string),
      account: String(bid.account),
      amount: BigInt(bid.amount as string),
      accepted: BigInt(bid.accepted as string),
      price: BigInt(bid.price as string),
      totalCommitted: BigInt(bid.totalCommitted as string),
      surplusCredited: bid.surplusCredited === true
    }));
    return { scannedTo: kept.scannedTo, bids };
  } catch {
    return null; // unreadable or blocked storage: read the history from the network instead
  }
}

function keepHistory(deployment: Deployment, scannedTo: number, bids: Bid[]) {
  if (!LOGS_APIS[deployment.chainId] || scannedTo < deployment.deployedAtBlock) {
    return;
  }
  const settled = bids.filter((bid) => bid.blockNumber <= scannedTo);
  try {
    localStorage.setItem(
      historyKey(deployment),
      JSON.stringify({ scannedTo, bids: settled }, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
    );
  } catch {
    // Storage full or blocked: the history is simply read from the network again next time.
  }
}

export function useAuction(
  provider: Provider | null,
  deployment: Deployment | null,
  account: string | null
): AuctionData {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);

  const lastBidBlock = useRef(-1);
  const shownBids = useRef<Bid[]>([]);
  // Not reset with the read context: the explorer's limit applies to this browser, whatever the auction.
  const explorerRetryAt = useRef(0);
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
    const kept = deployment ? readKeptHistory(deployment) : null;
    shownBids.current = kept?.bids ?? [];
    setSnapshot(null);
    setBids(shownBids.current);
    setError("");
    setOffline(false);
    setHistoryUnavailable(false);
    lastBidBlock.current = kept?.scannedTo ?? -1;
    // A new map rather than clear(): a read from the old context keeps writing into its own map.
    blockTimes.current = new Map();
  }, [contracts, deployment]);

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

    // Bid history: fetch only blocks we have not scanned yet, one chunk at a time. The auction itself is
    // already on screen, so history the network cannot provide is reported in the Bids panel and retried,
    // rather than shown as an error over the whole page.
    const latest = block?.number ?? 0;
    let from = Math.max(deployment.deployedAtBlock, lastBidBlock.current + 1);
    let historyComplete = true;
    try {
      while (from <= latest) {
        let to = Math.min(latest, from + LOG_CHUNK_BLOCKS - 1);
        let scanned = to;
        let logs: [BidLog[], BidLog[]];
        try {
          logs = await rpcBidLogs(auction, from, to);
        } catch (rpcError) {
          const api = LOGS_APIS[deployment.chainId];
          if (!api || Date.now() < explorerRetryAt.current) {
            throw rpcError;
          }
          // The RPC no longer serves these blocks: read everything left from the explorer in one go. The
          // explorer can trail the chain by a few blocks, so the newest ones are scanned again over the
          // RPC on the next refresh.
          to = latest;
          scanned = Math.max(from - 1, latest - EXPLORER_LAG_BLOCKS);
          try {
            logs = await explorerBidLogs(api, auction, from, to);
          } catch (explorerError) {
            const wait =
              explorerError instanceof ExplorerRateLimitError && explorerError.retryAfterMs !== null
                ? Math.min(explorerError.retryAfterMs, EXPLORER_MAX_WAIT_MS)
                : EXPLORER_RETRY_MS;
            explorerRetryAt.current = Date.now() + wait;
            throw explorerError;
          }
        }
        const fresh = await toBids(...logs, (blockNumber) => blockTime(times, blockNumber));
        if (stale()) {
          return;
        }
        // Recorded per chunk, so a failed request resumes here instead of rescanning from the start.
        lastBidBlock.current = scanned;
        if (fresh.length > 0) {
          // A rescanned block can return a bid already shown; keep each bid once.
          const shown = new Set(shownBids.current.map((bid) => bid.key));
          shownBids.current = [...shownBids.current, ...fresh.filter((bid) => !shown.has(bid.key))];
          setBids(shownBids.current);
        }
        from = to + 1;
      }
    } catch {
      historyComplete = false;
    }
    if (stale()) {
      return;
    }
    keepHistory(deployment, Math.min(lastBidBlock.current, latest - EXPLORER_LAG_BLOCKS), shownBids.current);
    setHistoryUnavailable(!historyComplete);
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

  return { snapshot, bids, error, offline, historyUnavailable, refresh };
}
