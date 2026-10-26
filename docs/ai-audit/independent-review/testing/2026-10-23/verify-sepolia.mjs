import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, formatEther, formatUnits } from "ethers";

// Read-only verification. No wallet, private key, signing, or transactions.
const root = new URL("../../../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const deployment = (await readJson("frontend/src/generated/deployments.json"))["11155111"];
const auctionAbi = (await readJson("frontend/src/generated/DutchAuction.json")).abi;
const tokenAbi = (await readJson("frontend/src/generated/GavoraToken.json")).abi;
const provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com", 11155111, {
  staticNetwork: true
});
const auction = new Contract(deployment.auction, auctionAbi, provider);
const token = new Contract(deployment.token, tokenAbi, provider);

try {
  const block = await provider.getBlock("latest");
  assert(block);
  const at = { blockTag: block.number };
  const names = ["status", "AUCTION_DURATION", "startTime", "endTime", "finalPrice", "reservePrice",
    "totalCommitted", "totalTokensSold", "totalTokensClaimed", "burnedUnsold", "participantCount",
    "claimedParticipantCount", "refundLiability", "issuerProceedsWithdrawn", "saleSupply", "owner"];
  const values = await Promise.all(names.map((name) => auction[name](at)));
  const state = Object.fromEntries(names.map((name, i) => [name, values[i]]));
  const [totalSupply, inventory, ethBalance] = await Promise.all([
    token.totalSupply(at), token.balanceOf(deployment.auction, at),
    provider.getBalance(deployment.auction, block.number)
  ]);
  const bids = [];
  const claims = [];
  for (let from = deployment.deployedAtBlock; from <= block.number; from += 10000) {
    const to = Math.min(block.number, from + 9999);
    bids.push(...await auction.queryFilter(auction.filters.ContributionReceived(), from, to));
    claims.push(...await auction.queryFilter(auction.filters.TokensClaimed(), from, to));
  }
  const sum = (items, key) => items.reduce((acc, event) => acc + event.args[key], 0n);
  assert.equal(state.AUCTION_DURATION, 1200n);
  assert.equal(state.endTime - state.startTime, 1200n);
  assert.equal(state.status, 4n);
  assert.equal(state.finalPrice, state.reservePrice);
  assert.equal(sum(bids, "accepted"), state.totalCommitted);
  assert.equal(sum(claims, "tokens"), state.totalTokensClaimed);
  assert.equal(state.totalTokensClaimed + inventory + state.burnedUnsold, state.saleSupply);
  assert.equal(totalSupply + state.burnedUnsold, state.saleSupply);
  assert(ethBalance >= state.totalCommitted - state.issuerProceedsWithdrawn + state.refundLiability);
  console.log("READ-ONLY SEPOLIA VERIFICATION: PASS");
  console.log(`Snapshot: block ${block.number}, ${new Date(block.timestamp * 1000).toISOString()}`);
  console.log(`Auction: ${deployment.auction}`);
  console.log(`Status: Finalized; duration: ${state.AUCTION_DURATION} seconds`);
  console.log(`Window: ${new Date(Number(state.startTime) * 1000).toISOString()} to ${new Date(Number(state.endTime) * 1000).toISOString()}`);
  console.log(`Final price: ${formatEther(state.finalPrice)} ETH/GVRA`);
  console.log(`Committed: ${formatEther(state.totalCommitted)} ETH; bids: ${bids.length}; participants: ${state.participantCount}`);
  console.log(`Sold: ${formatUnits(state.totalTokensSold, 18)} GVRA; claimed: ${formatUnits(state.totalTokensClaimed, 18)} GVRA`);
  console.log(`Burned: ${formatUnits(state.burnedUnsold, 18)} GVRA; inventory: ${formatUnits(inventory, 18)} GVRA`);
  console.log(`Proceeds withdrawn: ${formatEther(state.issuerProceedsWithdrawn)} ETH`);
  console.log(`Refund liabilities: ${formatEther(state.refundLiability)} ETH; contract balance: ${formatEther(ethBalance)} ETH`);
  for (const bid of bids) {
    console.log(`Bid: sent ${formatEther(bid.args.amount)} ETH, accepted ${formatEther(bid.args.accepted)} ETH, submission price ${formatEther(bid.args.price)} ETH/GVRA`);
    console.log(`  https://sepolia.etherscan.io/tx/${bid.transactionHash}`);
  }
  for (const claim of claims) console.log(`Claim: https://sepolia.etherscan.io/tx/${claim.transactionHash}`);
  console.log("Checks: exact duration, reserve settlement, bid/claim event totals, token conservation, ETH solvency.");
} finally {
  provider.destroy();
}
