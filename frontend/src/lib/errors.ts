import { Interface } from "ethers";

import { auctionAbi } from "./contracts";

const auctionInterface = new Interface(auctionAbi);

const CONTRACT_ERRORS: Record<string, string> = {
  AuctionNotStarted: "The auction hasn't started yet.",
  AuctionClosed: "The 20-minute bidding window has ended.",
  AuctionAlreadyCleared: "The auction has already sold out, so new bids are closed.",
  AuctionAlreadyStarted: "The auction has already been started.",
  AuctionNotFunded: "Deposit the GVRA sale supply into the auction before starting it.",
  AuctionNotFinalizable: "The auction can be finalized once the 20-minute window ends.",
  AuctionAlreadyFinalized: "The auction is already finalized.",
  AuctionNotFinalized: "This opens once the auction is finalized.",
  ZeroContribution: "Enter an amount greater than zero.",
  MinimumTokensNotMet:
    "The auction filled up before your bid was mined, so it would have bought less than its minimum. The bid was cancelled and none of your ETH was committed.",
  NoCommitment: "This wallet has no accepted bid.",
  AlreadyClaimed: "You have already claimed your GVRA.",
  NoRefundAvailable: "There is no refund waiting for this wallet.",
  NoProceedsAvailable: "There are no proceeds left to withdraw.",
  RefundTransferFailed: "The refund could not be sent to that address.",
  ProceedsTransferFailed: "The proceeds could not be sent to that address.",
  OutstandingClaims: "Rounding dust can be burned once every bidder has claimed.",
  NoTokensToBurn: "There is nothing left to burn.",
  InvalidAddress: "That address is not valid.",
  OwnableUnauthorizedAccount: "Only the issuer can do this."
};

type MaybeEthersError = {
  code?: string | number;
  shortMessage?: string;
  reason?: string;
  message?: string;
  revert?: { name?: string };
  data?: unknown;
  receipt?: unknown;
  info?: { error?: { code?: number } };
  error?: { code?: number };
};

/**
 * The auction's custom error behind a failure. ethers decodes it into `revert` only for read calls; when
 * a transaction fails, the raw revert data sits in `data`, possibly nested in the wallet's or node's own
 * error object, so it is found and decoded against the auction's ABI here.
 */
function contractErrorName(error: unknown, depth = 0): string | undefined {
  if (typeof error !== "object" || error === null || depth > 4) {
    return undefined;
  }
  const e = error as MaybeEthersError;
  if (e.revert?.name) {
    return e.revert.name;
  }
  if (typeof e.data === "string" && /^0x[0-9a-f]{8}/i.test(e.data)) {
    try {
      const name = auctionInterface.parseError(e.data)?.name;
      if (name) {
        return name;
      }
    } catch {
      // Not one of the auction's errors.
    }
  }
  for (const nested of [e.error, e.info, e.data]) {
    const name = contractErrorName(nested, depth + 1);
    if (name) {
      return name;
    }
  }
  return undefined;
}

/** Turns wallet, RPC and custom contract errors into a sentence a bidder can act on. */
export function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "Something went wrong. Please try again.";
  }
  const e = error as MaybeEthersError;

  if (e.code === "ACTION_REJECTED" || e.code === 4001 || e.info?.error?.code === 4001) {
    return "You rejected the request in your wallet.";
  }
  if (e.code === "INSUFFICIENT_FUNDS") {
    return "This wallet doesn't have enough ETH for that bid plus gas.";
  }
  const name = contractErrorName(e);
  if (name && CONTRACT_ERRORS[name]) {
    return CONTRACT_ERRORS[name];
  }
  if (e.code === "CALL_EXCEPTION" && e.receipt) {
    return "The transaction was reverted when it was mined, so nothing changed except the gas it used. The auction may have changed just before; check the dashboard and try again.";
  }
  return e.shortMessage ?? e.reason ?? e.message ?? "Transaction failed.";
}

/** True when a read failed because the RPC endpoint could not be reached or kept failing. */
export function isConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const e = error as MaybeEthersError;
  // ethers: request timed out, or HTTP errors (5xx, rate limiting) after its retries ran out.
  if (e.code === "TIMEOUT" || e.code === "SERVER_ERROR") {
    return true;
  }
  // fetch() itself rejects with "Failed to fetch" (Chrome), "NetworkError when attempting to
  // fetch resource." (Firefox), "Load failed" (Safari) or "fetch failed" (Node).
  return /failed to fetch|networkerror|load failed|fetch failed|ECONNREFUSED/i.test(e.message ?? "");
}
