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
  name: string;
  txHash: string;
  index: number;
  blockNumber: number;
  timestamp: bigint;
  args: Result;
};

/** The explorer refused because this address has used up its requests; `retryAfterMs` is when it resets. */
export class ExplorerRateLimitError extends Error {
  retryAfterMs: number | null;

  constructor(retryAfterMs: number | null) {
    super("The block explorer is limiting requests from this address.");
    this.retryAfterMs = retryAfterMs;
  }
}

// Explorers return at most 1,000 logs per request.
const PAGE_SIZE = 1000;
const TIMEOUT_MS = 15_000;

/** Milliseconds until the limit resets: Blockscout's x-ratelimit-reset, or the standard Retry-After (seconds). */
function retryAfter(response: Response): number | null {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    return reset;
  }
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/**
 * Reads a contract's logs from an explorer's Etherscan-compatible API. Public RPCs drop old logs; an
 * explorer keeps the full history, and Blockscout's API needs no key. That keyless API allows only a
 * few requests per hour, so every event comes back in one request and the caller sorts them by `name`.
 */
export async function explorerLogs(
  api: string,
  iface: Interface,
  address: string,
  fromBlock: number,
  toBlock: number
): Promise<DecodedLog[]> {
  const found = new Map<string, DecodedLog>();
  let from = fromBlock;
  for (;;) {
    const query = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      address,
      fromBlock: String(from),
      toBlock: String(toBlock)
    });
    // A hung request would hold up every later refresh, so give up and retry on the next one.
    const response = await fetch(`${api}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 429) {
      throw new ExplorerRateLimitError(retryAfter(response));
    }
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
        name: parsed.name,
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
