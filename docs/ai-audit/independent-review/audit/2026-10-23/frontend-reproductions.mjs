import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Temporary test dependency, deliberately kept outside the project's lockfile.
const auditRequire = createRequire("/private/tmp/dutchpoint-audit-20261023/package.json");
const React = auditRequire("react");
const { act, create } = auditRequire("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const scale = 10n ** 18n;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function compile(entry, mockEthers = false) {
  const result = await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: "audit-entry.ts" },
    bundle: true, format: "esm", platform: "node", jsx: "automatic", write: false,
    plugins: [{ name: "audit-dependencies", setup(b) {
      b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, (args) => ({
        path: auditRequire.resolve(args.path), external: true
      }));
      b.onResolve({ filter: /^ethers$/ }, () => mockEthers
        ? { path: "ethers", namespace: "audit" }
        : { path: `${root}node_modules/ethers/lib.esm/index.js`, external: true });
      b.onResolve({ filter: /\/lib\/contracts$/ }, () => ({ path: "contracts", namespace: "audit" }));
      b.onLoad({ filter: /.*/, namespace: "audit" }, (args) => ({ contents: args.path === "ethers" ? `
        export class Contract { constructor(address, abi, provider) { return provider.contractFor(address); } }
        export class EventLog { constructor(fields) { Object.assign(this, fields); } }
        export class BrowserProvider { constructor(ethereum) { this.ethereum = ethereum; } }
        export const getAddress = (address) => address;
      ` : `export const auctionAbi = [], tokenAbi = [], LOCAL_CHAIN_ID = 31337;
           export const LOCAL_RPC_URL = "http://127.0.0.1:8545";
           export const chainName = (id) => String(id);` }));
    } }]
  });
  const path = `/private/tmp/dutchpoint-audit-20261023/bundle-${compile.count++}.mjs`;
  await writeFile(path, result.outputFiles[0].text);
  return import(path);
}
compile.count = 0;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
let latest;

async function historyRace() {
  globalThis.window = { setInterval: () => 1, clearInterval: () => {} };
  const { useAuction, EventLog } = await compile(`
    export { useAuction } from "./frontend/src/hooks/useAuction.ts";
    export { EventLog } from "ethers";
  `, true);
  const gate = deferred();
  const providerFor = (name, blockNumber, wait) => {
    let first = true;
    const calls = [];
    const state = {
      name: "Gavora", symbol: "GVRA", owner: "issuer", saleSupply: 1000n * scale,
      startPrice: scale / 50n, reservePrice: scale / 200n, started: true,
      finalized: false, cleared: false, startTime: 1000n, lastCommitmentTimestamp: 1001n,
      clearingTime: 0n, clearingPrice: 0n, finalPrice: 0n, totalCommitted: scale,
      totalTokensSold: 0n, totalTokensClaimed: 0n, burnedUnsold: 0n,
      participantCount: 1n, claimedParticipantCount: 0n, refundLiability: 0n,
      issuerProceedsWithdrawn: 0n, balanceOf: 1000n * scale
    };
    return {
      calls, getCode: async () => "0x01", on: async () => {}, off: async () => {},
      getBlock: async (at) => {
        if (at === "latest" && first) { first = false; if (wait) await wait; }
        return { number: at === "latest" ? blockNumber : at, timestamp: 1000 + blockNumber };
      },
      contractFor: () => new Proxy({}, { get: (_, key) => {
        if (key === "filters") return { ContributionReceived: () => "bid-filter" };
        if (key === "queryFilter") return async (_, from, to) => {
          calls.push([from, to]);
          if (blockNumber - 1 < from || blockNumber - 1 > to) return [];
          return [new EventLog({ blockNumber: blockNumber - 1, transactionHash: `tx-${name}`,
            index: 0, args: { account: name, amount: scale, accepted: scale,
              price: scale / 50n, totalCommitted: scale } })];
        };
        return async () => state[key];
      } })
    };
  };
  const old = providerFor("old-chain", 12000000, gate.promise);
  const current = providerFor("new-chain", 100);
  const deployment = (chainId) => ({ chainId, auction: "auction", token: "token", deployedAtBlock: 1 });
  function Probe(props) { latest = useAuction(props.provider, props.deployment, null); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Probe, { provider: old, deployment: deployment(11155111) })); await tick(); });
  await act(async () => { renderer.update(React.createElement(Probe, { provider: current, deployment: deployment(31337) })); await tick(); });
  await act(async () => { gate.resolve(); await tick(); await tick(); });
  await act(async () => { await latest.refresh(); await tick(); });
  assert.equal(latest.snapshot.blockNumber, 100);
  assert.equal(current.calls.length, 0);
  assert.equal(latest.bids[0].account, "old-chain");
  console.log("CONFIRMED A2: switching chains during a read leaves old-chain bid history.");
  console.log(`  Current snapshot block: ${latest.snapshot.blockNumber}; history: ${latest.bids[0].account}; new-chain log requests: ${current.calls.length}.`);
  console.log("  The old cursor is 12,000,000; refreshing the new chain at block 100 never queries its bids.");
  await act(async () => renderer.unmount());
}

async function walletRace() {
  const { useWallet } = await compile('export { useWallet } from "./frontend/src/hooks/useWallet.ts";', true);
  const oldAccounts = deferred();
  const listeners = new Map();
  let reads = 0;
  const a = "0x1111111111111111111111111111111111111111";
  const b = "0x2222222222222222222222222222222222222222";
  globalThis.window = { ethereum: {
    request: async ({ method }) => method === "eth_accounts"
      ? (++reads === 1 ? oldAccounts.promise : [b]) : "0x7a69",
    on: (event, callback) => listeners.set(event, callback),
    removeListener: () => {}
  } };
  function Probe() { latest = useWallet(); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Probe)); await tick(); });
  await act(async () => { listeners.get("accountsChanged")([b]); await tick(); });
  assert.equal(latest.account, b);
  await act(async () => { oldAccounts.resolve([a]); await tick(); });
  assert.equal(latest.account, a);
  console.log("CONFIRMED A3: a stale eth_accounts response overwrites the newer wallet account.");
  console.log(`  Wallet changed to ${b}; hook reverted to ${latest.account} after the old response completed.`);
  await act(async () => renderer.unmount());
}

async function componentChecks() {
  const { BidPanel, PositionPanel, BidHistory, viewAt } = await compile(`
    export { BidPanel } from "./frontend/src/components/BidPanel.tsx";
    export { PositionPanel } from "./frontend/src/components/PositionPanel.tsx";
    export { BidHistory } from "./frontend/src/components/BidHistory.tsx";
    export { viewAt } from "./frontend/src/lib/auctionMath.ts";
  `);
  const state = { saleSupply: 1000n * scale, startPrice: scale / 50n,
    reservePrice: scale / 200n, started: true, finalized: false, cleared: false,
    startTime: 1000n, lastCommitmentTimestamp: 1000n, clearingTime: 0n,
    clearingPrice: 0n, finalPrice: 0n, totalCommitted: 0n };
  const position = { commitment: 0n, ethBalance: 100n * scale, claimed: false,
    tokensClaimed: 0n, tokenBalance: 0n, refundCredit: 0n };
  let sent;
  let renderer;
  await act(async () => { renderer = create(React.createElement(BidPanel, {
    view: viewAt(state, 1100n), position, connected: true, wrongNetwork: null,
    busy: false, onConnect: () => {}, onSwitchNetwork: () => {}, onBid: (amount) => { sent = amount; }
  })); });
  await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "-1" } }));
  const bid = renderer.root.findAllByType("button").find((node) => node.props.className === "btn primary wide");
  assert.equal(bid.props.disabled, false);
  await act(async () => bid.props.onClick());
  assert.equal(sent, -scale);
  console.log("CONFIRMED A4: entering -1 enables Bid -1 ETH and passes a negative transaction value to ethers.");
  await act(async () => renderer.unmount());

  const props = { view: viewAt(state, 1100n), position: { ...position, commitment: scale },
    finalPrice: 0n, saleSupply: state.saleSupply, busy: false, onClaim: () => {},
    onWithdrawRefund: () => {}, onAddToken: async () => true };
  await act(async () => { renderer = create(React.createElement(PositionPanel, props)); });
  const addButton = () => renderer.root.findAllByType("button").find((node) =>
    node.children.some((child) => typeof child === "string" && child.includes("GVRA")));
  await act(async () => { addButton().props.onClick(); await tick(); });
  assert.equal(addButton().props.disabled, true);
  await act(async () => renderer.update(React.createElement(PositionPanel, { ...props, onAddToken: async () => false })));
  assert.equal(addButton().props.disabled, true);
  console.log("DISCARDED CANDIDATE: isolated PositionPanel retains its add-token flag after a prop update.");
  console.log("  This is not a confirmed app defect: App clears the snapshot and unmounts the panel on a provider/deployment change.");
  await act(async () => renderer.unmount());

  await act(async () => { renderer = create(React.createElement(BidHistory, {
    bids: [{ key: "credited-refund", account: "0x1111111111111111111111111111111111111111",
      txHash: "tx", blockNumber: 1, timestamp: 1100n, amount: 12n * scale,
      accepted: 1125n * scale / 100n, price: 1125n * scale / 100000n,
      totalCommitted: 1125n * scale / 100n }],
    saleSupply: state.saleSupply, startTime: 1000n, account: null, explorer: null
  })); });
  const row = renderer.root.findByType("tbody").findAllByType("td");
  assert.equal(row[4].children[0], "0.75 ETH");
  console.log("CONFIRMED A5: bid history labels a 0.75 ETH surplus as Refunded even if the refund was credited, not paid.");
  console.log("  BidHistory has only ContributionReceived fields, so it cannot distinguish SurplusRefunded from RefundCredited.");
  await act(async () => renderer.unmount());
}

await historyRace();
await walletRace();
await componentChecks();
console.log("All reproduction assertions passed against the unmodified production source.");
