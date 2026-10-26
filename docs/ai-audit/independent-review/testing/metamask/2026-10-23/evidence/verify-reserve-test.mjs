import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Contract, JsonRpcProvider, parseEther } from 'ethers';

const provider = new JsonRpcProvider('http://127.0.0.1:8545');
try {
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  const deployment = JSON.parse(await readFile('frontend/src/generated/deployments.local.json'))['31337'];
  const abi = JSON.parse(await readFile('frontend/src/generated/DutchAuction.json')).abi;
  const tokenAbi = JSON.parse(await readFile('frontend/src/generated/GavoraToken.json')).abi;
  const auction = new Contract(deployment.auction, abi, provider);
  const token = new Contract(deployment.token, tokenAbi, provider);
  const address = '0x87887B3bF82e8ac2a3551720a3775d4cD2843817';
  const hashes = [
    '0x29a207b33f3afbbc4c3fec45b5d3efed9c3b284ee7749788a1fcbc57c2e1a32d',
    '0x84a7a5b217e6bca6bf25cd2563df811ab54b34b94f1aaa8c266758596234b031',
    '0xed1a5797c0dc3543b8e84efacb9ee85bd5115ce646cfafbcf44a6c50e7e23787',
    '0xc967c19024ca0edc149898c15bc178bef4838a998e7dbc5e25465bd3802f77a2',
  ];
  const transactions = [];
  for (const hash of hashes) {
    const receipt = await provider.getTransactionReceipt(hash);
    assert.equal(receipt.status, 1);
    assert.equal(receipt.from.toLowerCase(), address.toLowerCase());
    const events = receipt.logs.flatMap(log => {
      try { const e = auction.interface.parseLog(log); return e ? [{name:e.name,args:Array.from(e.args,String)}] : []; }
      catch { return []; }
    });
    transactions.push({hash,block:receipt.blockNumber,events});
  }
  assert.equal(await auction.AUCTION_DURATION(), 1200n);
  assert.equal(await auction.finalized(), true);
  assert.equal(await auction.cleared(), false);
  assert.equal(await auction.totalCommitted(), parseEther('1'));
  assert.equal(await auction.finalPrice(), parseEther('0.005'));
  assert.equal(await auction.burnedUnsold(), parseEther('800'));
  assert.equal(await auction.totalTokensClaimed(), parseEther('200'));
  assert.equal(await token.balanceOf(address), parseEther('200'));
  assert.equal(await token.totalSupply(), parseEther('200'));
  assert.equal(await token.balanceOf(deployment.auction), 0n);
  assert.equal(await provider.getBalance(deployment.auction), parseEther('1'));
  assert.equal(await auction.refundLiability(), 0n);
  const output = {result:'PASS',chainId:'31337',deployment,transactions,
    assertions:['All four transactions mined successfully from MetaMask wallet',
      'Duration remains 1200 seconds', '1 ETH accepted at reserve price 0.005 ETH/token',
      '800 GVRA burned and 200 GVRA subsequently claimed',
      'Token supply conserved; auction inventory zero; 1 ETH issuer proceeds still held']};
  await writeFile('../reserve-onchain-evidence.json',JSON.stringify(output,null,2));
  console.log(JSON.stringify(output,null,2));
} finally { provider.destroy(); }
