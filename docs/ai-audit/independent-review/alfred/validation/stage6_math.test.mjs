import test from 'node:test';
import assert from 'node:assert/strict';
import { priceAt, viewAt, tokensFor, Status } from '../../frontend/src/lib/auctionMath.ts';

const unit = 10n ** 18n;
const state = {saleSupply:1000n*unit, startPrice:unit/50n, reservePrice:unit/200n,
  started:true, finalized:false, cleared:false, startTime:1000n,
  lastCommitmentTimestamp:1001n, clearingTime:0n, clearingPrice:0n,
  finalPrice:0n, totalCommitted:10n*unit};

test('display lifecycle handles pending, time clearing, exact deadline and finalized priority', () => {
  assert.equal(viewAt({...state, started:false, totalCommitted:0n},1000n).status,Status.Pending);
  assert.equal(viewAt(state,1799n).status,Status.Active);
  assert.equal(viewAt(state,1800n).status,Status.Cleared);
  assert.equal(viewAt(state,2199n).status,Status.Cleared);
  assert.equal(viewAt(state,2200n).status,Status.AwaitingFinalization);
  assert.equal(viewAt({...state,finalized:true,finalPrice:unit/100n},2200n).status,Status.Finalized);
  assert.equal(viewAt({...state,totalCommitted:0n},2200n).price,state.reservePrice);
});

test('actual display price is bounded and monotonic over every second through twice the duration', () => {
  let previous = state.startPrice;
  for (let elapsed=0n;elapsed<=2400n;elapsed++) {
    const price=priceAt(state,state.startTime+elapsed);
    assert(price<=previous && price>=state.reservePrice && price<=state.startPrice);
    previous=price;
  }
  assert.equal(priceAt(state,999n),state.startPrice);
  assert.equal(priceAt(state,1400n),15n*unit/1000n);
  assert.equal(priceAt(state,1800n),unit/100n);
});

test('accepted commitment estimate does not decrease in this fixed-demand scenario', () => {
  let previous=0n;
  for(let elapsed=1n;elapsed<=1200n;elapsed++) {
    const view=viewAt(state,state.startTime+elapsed);
    const allocation=tokensFor(6n*unit,view.price);
    assert(allocation>=previous);
    previous=allocation;
  }
  assert.equal(previous,600n*unit);
});

test('P04 arithmetic example passes stated reserve-value bound but exceeds uint256 at start', () => {
  const max=(1n<<256n)-1n;
  const supply=10n**36n;
  const reserve=1n;
  assert(supply*reserve/unit>0n);
  assert(max>reserve);
  assert(supply*max/unit>max);
  // This checks mathematical bounds only. No Solidity deployment or mulDiv call is executed.
});
