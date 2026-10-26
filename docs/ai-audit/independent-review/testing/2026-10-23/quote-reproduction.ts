import assert from "node:assert/strict";
import { network } from "hardhat";
import { quoteBid, viewAt } from "../../../frontend/src/lib/auctionMath.ts";

const { ethers, networkHelpers } = await network.create();
const [issuer, alice, bob, carol] = await ethers.getSigners();
const saleSupply = ethers.parseUnits("1000", 18);
const startPrice = ethers.parseEther("0.02");
const reservePrice = ethers.parseEther("0.005");
const token = await (await ethers.getContractFactory("GavoraToken")).deploy(saleSupply, issuer.address);
await token.waitForDeployment();
const auction = await (await ethers.getContractFactory("DutchAuction")).deploy(
  await token.getAddress(), saleSupply, startPrice, reservePrice, issuer.address
);
await auction.waitForDeployment();
await (await token.transfer(await auction.getAddress(), saleSupply)).wait();
await (await auction.start()).wait();
const startTime = await auction.startTime();
await (await auction.connect(alice).contribute({ value: ethers.parseEther("6") })).wait();
await (await auction.connect(bob).contribute({ value: ethers.parseEther("4") })).wait();
const quote = quoteBid(viewAt({
  saleSupply, startPrice, reservePrice, startTime,
  started: true, finalized: false, cleared: false,
  lastCommitmentTimestamp: await auction.lastCommitmentTimestamp(),
  clearingTime: 0n, clearingPrice: 0n, finalPrice: 0n,
  totalCommitted: await auction.totalCommitted()
}, startTime + 700n), 0n, ethers.parseEther("1"));
await networkHelpers.time.setNextBlockTimestamp(Number(startTime + 740n));
const receipt = await (await auction.connect(carol).contribute({ value: ethers.parseEther("1") })).wait();
const refund = receipt.logs.map((log) => {
  try { return auction.interface.parseLog(log); } catch { return null; }
}).find((event) => event?.name === "SurplusRefunded");
await networkHelpers.time.setNextBlockTimestamp(Number(startTime + 1200n));
await (await auction.finalize()).wait();
await (await auction.connect(carol).claimTokens()).wait();
const actual = await token.balanceOf(carol.address);
assert(actual < quote.minTokens);
assert.equal(await auction.commitments(carol.address), ethers.parseEther("0.75"));
assert.equal(refund?.args.amount, ethers.parseEther("0.25"));
console.log("REPRODUCED: the pre-submission quote is not a guaranteed minimum.");
console.log(`At t=700s: a 1 ETH bid is quoted at ${ethers.formatUnits(quote.minTokens, 18)} GVRA.`);
console.log("At t=740s: its transaction lands; only 0.75 ETH fits, and 0.25 ETH is refunded.");
console.log(`At t=1200s: actual claim is ${ethers.formatUnits(actual, 18)} GVRA.`);
console.log("Cause: remaining ETH capacity falls while the wallet approval/transaction is pending.");
console.log("Contract accounting remains correct. BidPanel/FAQ/guide should describe this as an estimate,");
console.log("or qualify the minimum as applying only to ETH already accepted by the contract.");
console.log("This test observes the issue without changing auction or frontend source code.");
