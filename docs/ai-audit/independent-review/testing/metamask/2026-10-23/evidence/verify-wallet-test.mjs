import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Contract, JsonRpcProvider, parseEther } from 'ethers';

const provider = new JsonRpcProvider('http://127.0.0.1:8545');
try {
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  const artifact = JSON.parse(await readFile('frontend/src/generated/DutchAuction.json'));
  const tokenArtifact = JSON.parse(await readFile('frontend/src/generated/GavoraToken.json'));
  const address = '0x87887B3bF82e8ac2a3551720a3775d4cD2843817';
  const auction = new Contract('0x5FC8d32690cc91D4c39d9d3abcBD16989F875707', artifact.abi, provider);
  const token = new Contract('0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', tokenArtifact.abi, provider);
  const hashes = [
    '0xbb4fc356c13b3d7dc5850f78fad37d71a782db86c4c2529027dc83c1c622790b',
    '0xdbe0f5ffe063697e2a487ba5856679e6ae6817c045b0ef58e2720d7e9a624f90',
    '0xf04a0cf240417e12b546e567eeb7e042c63598af407adc52901924bfa28bf099',
    '0x5540bc70f22d98f96dbd97eae703fcf1d74f502d63962fe5c7a2f0c29cf0244e',
    '0x69dfdcdecee054e1cee4f9acd5eea0e542fa139a7b2ea62b7c25a03126c643f1',
    '0xbe8e49a6443438e5aa55176ca97f412105bc889f3a1b2c64e6578d374f9b9e3a',
    '0xcbe529a53a68242d005cf0fe0a39d2128255beaf8c72aafb640bd6f664f6a34c',
  ];
  let gasCost = 0n;
  const transactions = [];
  for (const hash of hashes) {
    const tx = await provider.getTransaction(hash);
    const receipt = await provider.getTransactionReceipt(hash);
    assert.equal(receipt.status, 1);
    assert.equal(tx.from.toLowerCase(), address.toLowerCase());
    gasCost += receipt.gasUsed * receipt.gasPrice;
    const events = receipt.logs.flatMap(log => {
      try { const e = auction.interface.parseLog(log); return e ? [{name:e.name, args:Array.from(e.args, String)}] : []; }
      catch { return []; }
    });
    transactions.push({hash, valueWei:String(tx.value), block:receipt.blockNumber, events});
  }
  const crossing = transactions[3].events;
  assert(crossing.some(e => e.name === 'SurplusRefunded' && e.args[1] === String(parseEther('2.425'))));
  assert.equal(await auction.AUCTION_DURATION(), 1200n);
  assert.equal(await auction.finalized(), true);
  assert.equal(await auction.totalCommitted(), parseEther('19.075'));
  assert.equal(await auction.finalPrice(), parseEther('0.019075'));
  assert.equal(await auction.tokensClaimed(address), parseEther('1000'));
  assert.equal(await token.balanceOf(address), parseEther('1000'));
  assert.equal(await auction.claimedParticipantCount(), 1n);
  assert.equal(await auction.participantCount(), 1n);
  assert.equal(await auction.refundLiability(), 0n);
  assert.equal(await auction.issuerProceedsWithdrawn(), parseEther('19.075'));
  assert.equal(await provider.getBalance(await auction.getAddress()), 0n);
  assert.equal(await provider.getBalance(address), parseEther('200') - gasCost);
  const output = {result:'PASS', chainId:'31337', address, gasCostWei:String(gasCost), transactions,
    assertions:['All seven MetaMask transactions mined successfully from the selected wallet',
      'Crossing surplus of 2.425 ETH returned', 'Exactly 1200-second configuration unchanged',
      '1000 GVRA claimed; one participant despite repeated bids',
      '19.075 ETH issuer proceeds withdrawn; no refund liabilities; auction ETH zero',
      'Wallet final ETH equals initial 200 ETH minus transaction gas']};
  await writeFile('../sold-out-onchain-evidence.json', JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally { provider.destroy(); }
