import { Interface, Provider, parseEther, parseUnits, zeroPadValue, toBeHex } from "ethers";

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
};

export function txHash(n: number): string {
  return zeroPadValue(toBeHex(n), 32);
}

/**
 * A minimal in-memory chain with one DutchPoint auction. It answers the reads `useAuction` makes
 * (contract calls, blocks, logs) and can hold back the first "latest block" read, to reproduce a
 * read that is still in flight when the user switches network.
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
      return { number, timestamp: 1_000_000 + number };
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
    releaseFirstBlockRead: () => release()
  };
}
