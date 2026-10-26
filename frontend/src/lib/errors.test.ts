import { Interface } from "ethers";
import { describe, expect, it } from "vitest";

import { auctionAbi } from "./contracts";
import { describeError } from "./errors";

const auction = new Interface(auctionAbi);

// ethers v6 decodes a custom error into `revert` only for read calls. When a transaction fails, the raw
// revert data is all there is, in shapes recorded from a local Hardhat node.
describe("describeError", () => {
  it("names the contract error when the wallet's gas estimate fails", () => {
    const data = auction.encodeErrorResult("MinimumTokensNotMet", [10n, 9n]);
    const error = { code: "CALL_EXCEPTION", data, info: { error: { code: 3, data } } };

    expect(describeError(error)).toMatch(/would have bought less than its minimum/);
  });

  it("names the contract error when the node rejects a transaction it mined", () => {
    const data = auction.encodeErrorResult("AuctionAlreadyCleared", []);
    const error = {
      code: "UNKNOWN_ERROR",
      shortMessage: "could not coalesce error",
      error: { code: 3, message: "VM Exception while processing transaction", data }
    };

    expect(describeError(error)).toBe("The auction has already sold out, so new bids are closed.");
  });

  it("explains a transaction that reverted on-chain without revert data", () => {
    const error = { code: "CALL_EXCEPTION", shortMessage: "transaction execution reverted", receipt: { status: 0 } };

    expect(describeError(error)).toMatch(/reverted when it was mined/);
  });

  it("falls back to the wallet's message for data that is not an auction error", () => {
    const error = { code: "CALL_EXCEPTION", shortMessage: "execution reverted", data: "0xdeadbeef" };

    expect(describeError(error)).toBe("execution reverted");
  });
});
