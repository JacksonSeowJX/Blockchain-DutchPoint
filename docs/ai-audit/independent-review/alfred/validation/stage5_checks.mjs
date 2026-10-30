// Audit-only checks. No blockchain connection, React renderer or dependency installation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { viewAt, quoteBid, Status } from '../../frontend/src/lib/auctionMath.ts';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const files = ['frontend/src/lib/auctionMath.ts', 'frontend/src/lib/format.ts',
  'frontend/src/components/BidPanel.tsx', 'frontend/src/components/BidHistory.tsx',
  'frontend/src/hooks/useWallet.ts'];
console.log('Stage 5 isolated source-level checks');
console.log('Runtime ' + process.version);
console.log('HEAD ' + execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
for (const path of files) console.log('SHA256 ' + path + ' ' + createHash('sha256').update(read(path)).digest('hex'));
const scale = 10n ** 18n;
const state = {saleSupply:1000n*scale, startPrice:scale/50n, reservePrice:scale/200n,
  started:true, finalized:false, cleared:false, startTime:1000n,
  lastCommitmentTimestamp:1001n, clearingTime:0n, clearingPrice:0n,
  finalPrice:0n, totalCommitted:10n*scale};
const before = viewAt(state, 1400n);
const later = viewAt(state, 1600n);
assert.equal(before.status, Status.Active);
assert.equal(later.status, Status.Active);
const originalQuote = quoteBid(before, 0n, 5n*scale);
const laterQuote = quoteBid(later, 0n, 5n*scale);
assert(originalQuote.minTokens > laterQuote.minTokens);
assert.equal(laterQuote.minTokens, 200n*scale);
console.log('PASS C01 pending quote decreases from ' + originalQuote.minTokens + ' to ' + laterQuote.minTokens + ' token units without another bid');
console.log('Later accepted wei ' + laterQuote.accepted + ', surplus wei ' + laterQuote.refunded);

const format = read(files[1]);
const trimSource = format.slice(format.indexOf('export function trimDecimal'), format.indexOf('function groupThousands'));
assert(trimSource.startsWith('export function trimDecimal'));
const trimModule = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(trimSource)).toString('base64'));
const exactCapacity = 123456789000000000n;
const truncated = trimModule.trimDecimal('0.123456789', 6);
assert.equal(truncated, '0.123456');
const enteredWei = 123456000000000000n;
const shortQuote = quoteBid({...before, capacity:exactCapacity}, 0n, enteredWei);
assert.equal(shortQuote.clearsAuction, false);
console.log('PASS C02 sell-out shortcut truncates 0.123456789 to ' + truncated + ', shortfall wei ' + (exactCapacity-enteredWei));

const panel = read(files[2]);
const predicate = panel.match(/disabled: (busy \|\| amount === 0n \|\| inputError !== "")/);
assert(predicate);
const disabled = new Function('busy','amount','inputError','return ' + predicate[1]);
assert.equal(disabled(false, -scale, ''), false);
assert(quoteBid(before, 0n, -scale).minTokens < 0n);
console.log('PASS C03 negative parsed amount passes exact disabled predicate and produces negative quote');
console.log('C03 boundary: ethers parseEther and actual wallet request not executed');

const history = read(files[3]);
assert(history.includes('<th scope="col" className="num">Refunded</th>'));
const expression = history.match(/const refunded = ([^;]+);/)[1];
const displayedRefund = new Function('bid', 'return ' + expression)({amount:2n*scale, accepted:125n*scale/100n});
assert.equal(displayedRefund, 75n*scale/100n);
console.log('PASS C04 history displays surplus as refunded without a payment-success input, wei ' + displayedRefund);
console.log('C04 boundary: rejecting-receiver chain scenario not executed');

const wallet = read(files[4]);
const syncBody = wallet.match(/const sync = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[ethereum\]\);/)[1];
const syncSource = stripTypeScriptTypes('async function auditSync(ethereum,setChainId,setAccount,setProvider,BrowserProvider,getAddress){' + syncBody + '}');
const sync = new Function('return ' + syncSource)();
await assert.rejects(sync({request:async()=>{throw new Error('offline');}},()=>{},()=>{},()=>{},class {},x=>x), /offline/);
assert(wallet.includes('void sync();'));
console.log('PASS C05 exact sync body propagates provider rejection, effect/event call sites discard promise');
console.log('C05 boundary: no mounted React hook or browser unhandled-rejection event tested');
console.log('5 checks passed. These reproduce source-level counterexamples, not EVM or browser integration tests.');
