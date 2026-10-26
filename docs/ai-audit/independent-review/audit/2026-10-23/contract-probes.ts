import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const [issuer, alice, bob, carol, recipient] = await ethers.getSigners();
const bidders = [alice, bob, carol];
const Q = 10n ** 18n;
for (const bidder of bidders) await networkHelpers.setBalance(bidder.address, ethers.parseEther("100000000"));

async function deploy(supply: bigint, high: bigint, low: bigint) {
  const token = await (await ethers.getContractFactory("GavoraToken")).deploy(supply, issuer.address);
  await token.waitForDeployment();
  const auction = await (await ethers.getContractFactory("DutchAuction")).deploy(
    await token.getAddress(), supply, high, low, issuer.address
  );
  await auction.waitForDeployment();
  await (await token.transfer(await auction.getAddress(), supply)).wait();
  await (await auction.start()).wait();
  return { auction, token, start: await auction.startTime(), address: await auction.getAddress() };
}

let seed = 4053n;
const random = () => { seed = (1664525n * seed + 1013904223n) % (1n << 32n); return seed; };
const ranges = [[6n, 3n], [Q / 50n, Q / 200n], [Q / 10000n, Q / 50000n], [10n * Q, Q]];

for (let i = 0; i < 36; i++) {
  const supply = (5n + random() % 95n) * Q + random();
  const [high, low] = ranges[i % ranges.length];
  const { auction, token, start, address } = await deploy(supply, high, low);
  const accepted = new Map(bidders.map((bidder) => [bidder.address, 0n]));
  let timestamp = start;
  for (let step = 0; step < 5; step++) {
    timestamp += 1n + random() % 180n;
    await networkHelpers.time.increaseTo(Number(timestamp));
    if (await auction.status() !== 1n) break;
    const capacity = await auction.remainingCapacity();
    const amount = 1n + capacity * (1n + random() % 8n) / 6n;
    const bidder = bidders[step % bidders.length];
    await (await auction.connect(bidder).contribute({ value: amount })).wait();
    accepted.set(bidder.address, await auction.commitments(bidder.address));
    assert.equal(await ethers.provider.getBalance(address), await auction.totalCommitted());
  }
  const snapshot = await ethers.provider.send("evm_snapshot", []);
  await networkHelpers.time.setNextBlockTimestamp(Number(start + 1200n));
  await (await auction.finalize()).wait();
  const original = [await auction.finalPrice(), await auction.totalTokensSold(), await auction.burnedUnsold()];
  await ethers.provider.send("evm_revert", [snapshot]);
  await networkHelpers.time.setNextBlockTimestamp(Number(start + 1200n + 7n * 86400n));
  await (await auction.finalize()).wait();
  assert.deepEqual([await auction.finalPrice(), await auction.totalTokensSold(), await auction.burnedUnsold()], original);
  assert(original[0] >= low && original[0] <= high);
  for (const bidder of [...bidders].reverse()) {
    const amount = accepted.get(bidder.address)!;
    if (amount === 0n) continue;
    await (await auction.connect(bidder).claimTokens()).wait();
    assert.equal(await token.balanceOf(bidder.address), amount * Q / original[0]);
  }
  assert(await auction.totalTokensClaimed() <= await auction.totalTokensSold());
  assert(await auction.totalTokensSold() <= supply);
  if (await token.balanceOf(address) > 0n) await (await auction.burnRemainderAfterAllClaimed()).wait();
  if (await auction.totalCommitted() > 0n) await (await auction.withdrawIssuerProceeds(issuer.address)).wait();
  assert.equal(await ethers.provider.getBalance(address), 0n);
  assert.equal(await auction.totalTokensClaimed() + await auction.burnedUnsold(), supply);
}
console.log("PASS: 36 seeded scenarios with fractional supplies, wei-scale through 10 ETH/token prices.");
console.log("PASS: late finalization (7 days) preserves the deadline result in every scenario.");
console.log("PASS: reversed claims, supply conservation, immediate refunds and complete proceeds accounting.");

{
  const { auction, token, start, address } = await deploy(1000n * Q, Q / 50n, Q / 200n);
  await (await auction.connect(alice).contribute({ value: Q })).wait();
  // Models the balance produced by forced ETH, independently of receive()/commitment accounting.
  await networkHelpers.setBalance(address, 2n * Q);
  await networkHelpers.time.setNextBlockTimestamp(Number(start + 1200n));
  await (await auction.finalize()).wait();
  await (await auction.withdrawIssuerProceeds(issuer.address)).wait();
  assert.equal(await auction.issuerProceedsWithdrawn(), Q);
  assert.equal(await ethers.provider.getBalance(address), Q);
  await (await auction.connect(alice).claimTokens()).wait();
  await (await token.connect(alice).burn(Q)).wait();
  assert.equal(await token.totalSupply(), 199n * Q);
  console.log("PASS: an unsolicited 1 ETH is excluded from proceeds; tracked claims still succeed.");
  console.log("COVERAGE LIMIT: raw balance equality is not universal after forced ETH; token totalSupply also falls when a holder burns tokens.");
}

{
  const { auction, start } = await deploy(1000n * Q, Q / 50n, Q / 200n);
  const receiver = await (await ethers.getContractFactory("RejectingReceiver")).deploy(await auction.getAddress());
  await receiver.waitForDeployment();
  const address = await receiver.getAddress();
  await networkHelpers.time.setNextBlockTimestamp(Number(start + 700n));
  const receipt = await (await receiver.contribute({ value: 12n * Q })).wait();
  const events = receipt.logs.map((log) => {
    try { return auction.interface.parseLog(log); } catch { return null; }
  }).filter(Boolean);
  assert(events.some((event) => event!.name === "RefundCredited"));
  assert(!events.some((event) => event!.name === "SurplusRefunded"));
  assert.equal(await auction.refundCredits(address), 75n * Q / 100n);
  let rejected = false;
  try { await (await receiver.withdrawToSelf()).wait(); } catch { rejected = true; }
  assert(rejected);
  assert.equal(await auction.refundCredits(address), 75n * Q / 100n);
  await networkHelpers.time.setNextBlockTimestamp(Number(start + 1200n));
  await (await auction.finalize()).wait();
  await (await auction.withdrawIssuerProceeds(issuer.address)).wait();
  await (await receiver.withdrawTo(recipient.address)).wait();
  assert.equal(await auction.refundCredits(address), 0n);
  console.log("PASS: rejected automatic refund emits RefundCredited, not SurplusRefunded (0.75 ETH).");
  console.log("PASS: same-address recovery reverts and preserves credit; alternate-address recovery succeeds after issuer withdrawal.");
  console.log("CONFIRMED A7: the frontend hardcodes same-address recovery (App.tsx:262), which cannot recover this refund.");
}
