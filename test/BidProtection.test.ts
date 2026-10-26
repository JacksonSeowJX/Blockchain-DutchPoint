import { expect } from "chai";
import { network } from "hardhat";

// Bid protection: contributeWithMinimum(minTokens) reverts unless the bid buys at least `minTokens` GVRA at
// the price when it is mined. The final price can only be at or below that price, so the bidder's claim for
// the bid is at least `minTokens`. This makes the quote that independent-review finding A1 showed to be
// unguaranteed into an on-chain promise (docs/ai-audit/report.md, third pass).

const TOKEN_SCALE = 10n ** 18n;
const DURATION = 1200n;

function tokensFor(commitment: bigint, price: bigint): bigint {
  return (commitment * TOKEN_SCALE) / price;
}

// A fixed gas limit skips gas estimation, so a reverting bid is mined at the timestamp set for the next block.
const MINED = { gasLimit: 500_000n };

async function deployStarted() {
  const { ethers, networkHelpers } = await network.create();
  const [issuer, alice, bob] = await ethers.getSigners();

  const saleSupply = ethers.parseUnits("1000", 18);
  const token = (await (await ethers.getContractFactory("GavoraToken")).deploy(saleSupply, issuer.address)) as any;
  const auction = (await (await ethers.getContractFactory("DutchAuction")).deploy(
    await token.getAddress(),
    saleSupply,
    ethers.parseEther("0.02"),
    ethers.parseEther("0.005"),
    issuer.address
  )) as any;

  await token.connect(issuer).transfer(await auction.getAddress(), saleSupply);
  await auction.connect(issuer).start();
  const start = BigInt(await auction.startTime());

  return { ethers, networkHelpers, alice, bob, token, auction, start };
}

describe("Bid protection (minimum tokens)", function () {
  it("A1: the reported bid reverts instead of buying 69.77 GVRA against a quote of 88.89", async function () {
    const f = await deployStarted();
    await f.auction.connect(f.alice).contribute({ value: f.ethers.parseEther("10") });

    // Quoted at t = 700s: 1 ETH buys 88.89 GVRA at 0.01125 ETH.
    const quote = tokensFor(f.ethers.parseEther("1"), await f.auction.priceAt(f.start + 700n));
    expect(quote).to.equal(88_888888888888888888n);

    // Mined at t = 740s, when only 0.75 ETH still fits, at 0.01075 ETH.
    await f.networkHelpers.time.setNextBlockTimestamp(Number(f.start + 740n));
    await expect(
      f.auction.connect(f.bob).contributeWithMinimum(quote, { value: f.ethers.parseEther("1"), ...MINED })
    )
      .to.be.revertedWithCustomError(f.auction, "MinimumTokensNotMet")
      .withArgs(quote, 69_767441860465116279n);

    // Nothing was accepted, and the auction is still open.
    expect(await f.auction.commitments(f.bob.address)).to.equal(0n);
    expect(await f.auction.totalCommitted()).to.equal(f.ethers.parseEther("10"));
    expect(await f.auction.clearingTime()).to.equal(0n);
  });

  it("A1: without a minimum the same bid is partly filled and buys 69.77 GVRA", async function () {
    const f = await deployStarted();
    await f.auction.connect(f.alice).contribute({ value: f.ethers.parseEther("10") });

    await f.networkHelpers.time.setNextBlockTimestamp(Number(f.start + 740n));
    await f.auction.connect(f.bob).contribute({ value: f.ethers.parseEther("1") });
    expect(await f.auction.commitments(f.bob.address)).to.equal(f.ethers.parseEther("0.75"));

    await f.networkHelpers.time.setNextBlockTimestamp(Number(f.start + DURATION));
    await f.auction.finalize();
    await f.auction.connect(f.bob).claimTokens();
    expect(await f.token.balanceOf(f.bob.address)).to.equal(69_767441860465116279n);
  });

  it("a fully accepted bid always meets a minimum quoted at an earlier price", async function () {
    const f = await deployStarted();
    const amount = f.ethers.parseEther("2");
    const quote = tokensFor(amount, await f.auction.priceAt(f.start + 300n));

    // Mined five minutes after the quote: the price is lower, so the same ETH buys more.
    await f.networkHelpers.time.setNextBlockTimestamp(Number(f.start + 600n));
    await f.auction.connect(f.bob).contributeWithMinimum(quote, { value: amount });
    expect(await f.auction.commitments(f.bob.address)).to.equal(amount);

    await f.networkHelpers.time.setNextBlockTimestamp(Number(f.start + DURATION));
    await f.auction.finalize();
    await f.auction.connect(f.bob).claimTokens();
    expect(await f.token.balanceOf(f.bob.address)).to.be.at.least(quote);
  });

  it("the minimum is inclusive: exactly what the bid buys passes, one unit more reverts", async function () {
    const passes = await deployStarted();
    const amount = passes.ethers.parseEther("1");
    const price = await passes.auction.priceAt(passes.start + 500n);
    const tokens = tokensFor(amount, price);
    await passes.networkHelpers.time.setNextBlockTimestamp(Number(passes.start + 500n));
    await expect(passes.auction.connect(passes.bob).contributeWithMinimum(tokens, { value: amount }))
      .to.emit(passes.auction, "ContributionReceived")
      .withArgs(passes.bob.address, amount, amount, price, amount);

    const reverts = await deployStarted();
    await reverts.networkHelpers.time.setNextBlockTimestamp(Number(reverts.start + 500n));
    await expect(
      reverts.auction.connect(reverts.bob).contributeWithMinimum(tokens + 1n, { value: amount, ...MINED })
    )
      .to.be.revertedWithCustomError(reverts.auction, "MinimumTokensNotMet")
      .withArgs(tokens + 1n, tokens);
  });

  it("a crossing bid that meets its minimum clears the auction and refunds the surplus", async function () {
    const f = await deployStarted();
    await f.auction.connect(f.alice).contribute({ value: f.ethers.parseEther("10") });

    // At t = 700s, 1.25 ETH buys the remaining 111.11 GVRA; the other 0.75 ETH comes back.
    const price = f.ethers.parseEther("0.01125");
    const minimum = tokensFor(f.ethers.parseEther("1.25"), price);
    await f.networkHelpers.time.setNextBlockTimestamp(Number(f.start + 700n));
    await expect(f.auction.connect(f.bob).contributeWithMinimum(minimum, { value: f.ethers.parseEther("2") }))
      .to.emit(f.auction, "SurplusRefunded")
      .withArgs(f.bob.address, f.ethers.parseEther("0.75"));

    expect(await f.auction.commitments(f.bob.address)).to.equal(f.ethers.parseEther("1.25"));
    expect(await f.auction.clearingPrice()).to.equal(price);
  });

  it("a minimum of zero accepts the bid exactly like contribute()", async function () {
    const f = await deployStarted();
    await f.auction.connect(f.bob).contributeWithMinimum(0n, { value: f.ethers.parseEther("1") });
    expect(await f.auction.commitments(f.bob.address)).to.equal(f.ethers.parseEther("1"));
  });
});
