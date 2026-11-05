import { Interface, Result } from "ethers";

/** One log as an Etherscan-compatible explorer API returns it (numbers as hex strings). */
type ExplorerLog = {
  blockNumber: string;
  data: string;
  logIndex: string;
  timeStamp: string;
  topics: (string | null)[];
  transactionHash: string;
};

export type DecodedLog = {
  txHash: string;
  index: number;
  blockNumber: number;
  timestamp: bigint;
  args: Result;
};

// Explorers return at most 1,000 logs per request.
const PAGE_SIZE = 1000;
const TIMEOUT_MS = 15_000;

/**
 * Reads one event's logs for a contract from an explorer's Etherscan-compatible API. Public RPCs drop
 * old logs; an explorer keeps the full history, and Blockscout's API needs no key.
 */
export async function explorerLogs(
  api: string,
  iface: Interface,
  address: string,
  event: string,
  fromBlock: number,
  toBlock: number
): Promise<DecodedLog[]> {
  const topic0 = iface.getEvent(event)!.topicHash;
  const found = new Map<string, DecodedLog>();
  let from = fromBlock;
  for (;;) {
    const query = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      address,
      topic0,
      fromBlock: String(from),
      toBlock: String(toBlock)
    });
    // A hung request would hold up every later refresh, so give up and retry on the next one.
    const response = await fetch(`${api}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`The block explorer answered HTTP ${response.status}.`);
    }
    const body = (await response.json()) as { message?: string; result?: ExplorerLog[] | string };
    // "No logs found" comes with an empty list; a failure puts a message in `result` instead.
    if (!Array.isArray(body.result)) {
      throw new Error(`The block explorer answered: ${body.message ?? "no result"}.`);
    }
    for (const log of body.result) {
      const parsed = iface.parseLog({
        topics: log.topics.filter((topic): topic is string => topic !== null),
        data: log.data
      });
      if (!parsed) {
        continue;
      }
      const index = Number(log.logIndex);
      found.set(`${log.transactionHash}-${index}`, {
        txHash: log.transactionHash,
        index,
        blockNumber: Number(log.blockNumber),
        timestamp: BigInt(log.timeStamp),
        args: parsed.args
      });
    }
    // A full page may have been cut off mid-block: read on from its last block. Logs read twice are
    // kept once, by key.
    const last = body.result.length > 0 ? Number(body.result[body.result.length - 1].blockNumber) : from;
    if (body.result.length < PAGE_SIZE || last <= from) {
      break;
    }
    from = last;
  }
  return [...found.values()].sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
}
