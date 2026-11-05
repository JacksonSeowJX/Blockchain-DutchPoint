import { Interface, Provider, makeError, parseEther, parseUnits, zeroPadValue, toBeHex } from "ethers";

import { Deployment, auctionAbi, tokenAbi } from "../lib/contracts";

const auctionInterface = new Interface(auctionAbi);
const tokenInterface = new Interface(tokenAbi);

type FakeEvent = {
  name: "ContributionReceived" | "SurplusRefunded" | "RefundCredited";
  args: unknown[];
  blockNumber: number;
  txHash: string;
};

export type FakeChain = {
  provider: Provider;
  deployment: Deployment;
  /** Every eth_getLogs range this chain was asked for. */
  logQueries: { fromBlock: number; toBlock: number }[];
  /** Resolves the delayed "latest block" read, if the chain was created with `delayFirstBlockRead`. */
  releaseFirstBlockRead: () => void;
  /** A `fetch` that answers like Blockscout's Etherscan-compatible logs API, from the same events. */
  explorerFetch: typeof fetch;
};

export function txHash(n: number): string {
  return zeroPadValue(toBeHex(n), 32);
}

/**
 * A minimal in-memory chain with one DutchPoint auction. It answers the reads `useAuction` makes
 * (contract calls, blocks, logs) and can hold back the first "latest block" read, to reproduce a
 * read that is still in flight when the user switches network. With `prunedBefore`, eth_getLogs fails
 * for older blocks the way PublicNode's keyless Sepolia RPC does once it has dropped them.
 */
export function fakeChain(options: {
  chainId: number;
  auction: string;
  token: string;
  latestBlock: number;
  deployedAtBlock: number;
  totalCommitted?: bigint;
  events?: FakeEvent[];
  delayFirstBlockRead?: boolean;
  prunedBefore?: number;
}): FakeChain {
  const logQueries: FakeChain["logQueries"] = [];
  let release: () => void = () => {};
  let firstBlockRead: Promise<void> | null = options.delayFirstBlockRead
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : null;

  const state: Record<string, unknown> = {
    owner: "0x00000000000000000000000000000000000000AA",
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
    totalCommitted: options.totalCommitted ?? 0n,
    totalTokensSold: 0n,
    totalTokensClaimed: 0n,
    burnedUnsold: 0n,
    participantCount: BigInt((options.events ?? []).filter((e) => e.name === "ContributionReceived").length),
    claimedParticipantCount: 0n,
    refundLiability: 0n,
    issuerProceedsWithdrawn: 0n
  };

  const logs = (options.events ?? []).map((event) => {
    const { data, topics } = auctionInterface.encodeEventLog(auctionInterface.getEvent(event.name)!, event.args);
    return {
      address: options.auction,
      data,
      topics,
      blockNumber: event.blockNumber,
      blockHash: txHash(event.blockNumber + 1_000_000_000),
      transactionHash: event.txHash,
      transactionIndex: 0,
      index: 0,
      removed: false
    };
  });
  const blockTimestamp = (number: number) => 1_000_000 + number;

  const provider = {
    async getCode() {
      return "0x6080";
    },
    async getBlock(tag: string | number) {
      if (tag === "latest" && firstBlockRead) {
        const gate = firstBlockRead;
        firstBlockRead = null;
        await gate;
      }
      const number = tag === "latest" ? options.latestBlock : Number(tag);
      return { number, timestamp: blockTimestamp(number) };
    },
    async getBalance() {
      return parseEther("100");
    },
    async call(tx: { to: string; data: string }) {
      const isAuction = tx.to.toLowerCase() === options.auction.toLowerCase();
      const iface = isAuction ? auctionInterface : tokenInterface;
      const parsed = iface.parseTransaction({ data: tx.data })!;
      let value: unknown;
      if (!isAuction) {
        value = { name: "Gavora", symbol: "GVRA", balanceOf: parseUnits("1000", 18) }[parsed.name];
      } else {
        value = state[parsed.name];
      }
      return iface.encodeFunctionResult(parsed.fragment, [value]);
    },
    async getLogs(filter: { address: string; topics: (string | null)[]; fromBlock: number; toBlock: number }) {
      logQueries.push({ fromBlock: Number(filter.fromBlock), toBlock: Number(filter.toBlock) });
      if (options.prunedBefore !== undefined && Number(filter.fromBlock) < options.prunedBefore) {
        // What ethers reports for PublicNode's answer to a range it no longer keeps.
        throw makeError("could not coalesce error", "UNKNOWN_ERROR", {
          error: { code: 4444, message: "pruned history unavailable" }
        });
      }
      return logs
        .filter((log) => log.topics[0] === filter.topics[0])
        .filter((log) => log.blockNumber >= Number(filter.fromBlock) && log.blockNumber <= Number(filter.toBlock))
        .map((log) => ({ ...log, provider }));
    },
    async on() {
      return provider;
    },
    async off() {
      return provider;
    },
    get provider() {
      return provider;
    }
  };

  return {
    provider: provider as unknown as Provider,
    deployment: {
      chainId: options.chainId,
      networkName: `chain-${options.chainId}`,
      token: options.token,
      auction: options.auction,
      deployedAtBlock: options.deployedAtBlock,
      explorer: null
    },
    logQueries,
    releaseFirstBlockRead: () => release(),
    async explorerFetch(input: RequestInfo | URL) {
      const query = new URL(String(input)).searchParams;
      const toBlock = query.get("toBlock") === "latest" ? options.latestBlock : Number(query.get("toBlock"));
      const result = logs
        .filter((log) => log.address.toLowerCase() === query.get("address")?.toLowerCase())
        .filter((log) => !query.get("topic0") || log.topics[0] === query.get("topic0"))
        .filter((log) => log.blockNumber >= Number(query.get("fromBlock")) && log.blockNumber <= toBlock)
        .map((log) => ({
          address: log.address.toLowerCase(),
          blockNumber: toBeHex(log.blockNumber),
          data: log.data,
          logIndex: toBeHex(log.index),
          timeStamp: toBeHex(blockTimestamp(log.blockNumber)),
          // Blockscout pads the topic list to four entries with null.
          topics: [...log.topics, null, null, null, null].slice(0, 4),
          transactionHash: log.transactionHash,
          transactionIndex: toBeHex(log.transactionIndex)
        }));
      const body =
        result.length > 0 ? { status: "1", message: "OK", result } : { status: "0", message: "No logs found", result: [] };
      return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    }
  };
}
