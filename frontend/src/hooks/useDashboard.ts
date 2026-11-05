import { Contract, ContractTransactionResponse, JsonRpcProvider, Provider } from "ethers";
import { useCallback, useMemo, useState } from "react";

import { viewAt } from "../lib/auctionMath";
import {
  auctionAbi,
  chainName,
  defaultChainId,
  deployedChainIds,
  deploymentFor,
  readRpcUrl
} from "../lib/contracts";
import { describeError } from "../lib/errors";
import { useAuction } from "./useAuction";
import { useNow } from "./useNow";
import { useTheme } from "./useTheme";
import { useWallet } from "./useWallet";

export type TxState =
  | { stage: "idle" }
  | { stage: "wallet"; label: string }
  | { stage: "mining"; label: string; hash: string }
  | { stage: "done"; label: string; hash: string }
  | { stage: "failed"; label: string; message: string };

/** Everything the dashboard reads and does, separate from how a layout presents it. */
export function useDashboard() {
  const wallet = useWallet();
  const theme = useTheme();
  const now = useNow();
  const [tx, setTx] = useState<TxState>({ stage: "idle" });

  // Read through the wallet when it is on a chain with a deployment; otherwise fall back to a
  // read-only RPC so the auction is visible before anyone connects.
  const readOnlyProvider = useMemo(
    () => (readRpcUrl ? new JsonRpcProvider(readRpcUrl, defaultChainId, { staticNetwork: true }) : null),
    []
  );
  const walletDeployment = deploymentFor(wallet.chainId);
  const usingWallet = wallet.provider !== null && walletDeployment !== null;
  const provider: Provider | null = usingWallet ? wallet.provider : readOnlyProvider;
  const deployment = usingWallet ? walletDeployment : deploymentFor(defaultChainId);
  const account = usingWallet ? wallet.account : null;

  const { snapshot, bids, error, offline, refresh } = useAuction(provider, deployment, account);

  // Extrapolate the chain clock between blocks so the countdown and price move every second.
  const chainNow = snapshot
    ? snapshot.blockTimestamp + BigInt(Math.max(0, Math.floor((now - snapshot.loadedAt) / 1000)))
    : 0n;
  const view = snapshot ? viewAt(snapshot, chainNow) : null;

  // A wallet on a chain without a deployment is offered the default chain if it has one,
  // otherwise any chain that does; with no deployment anywhere there is nothing to switch to.
  const switchTarget = deploymentFor(defaultChainId) ? defaultChainId : (deployedChainIds[0] ?? null);
  const wrongNetwork =
    wallet.account !== null && walletDeployment === null && switchTarget !== null ? chainName(switchTarget) : null;
  const switchNetwork = () => {
    if (switchTarget !== null) {
      void wallet.switchChain(switchTarget);
    }
  };
  const canTransact = usingWallet && wallet.account !== null;
  const isOwner =
    snapshot !== null && account !== null && snapshot.owner.toLowerCase() === account.toLowerCase();
  const busy = tx.stage === "wallet" || tx.stage === "mining";

  const run = useCallback(
    async (label: string, action: (auction: Contract) => Promise<ContractTransactionResponse>) => {
      if (!wallet.provider || !deployment) {
        return;
      }
      setTx({ stage: "wallet", label });
      try {
        const signer = await wallet.provider.getSigner();
        // The page may still show an account or network the wallet has just switched away from.
        const [signerAddress, network] = await Promise.all([signer.getAddress(), wallet.provider.getNetwork()]);
        if (wallet.account && signerAddress.toLowerCase() !== wallet.account.toLowerCase()) {
          throw new Error("Your wallet switched accounts. Check the account shown in MetaMask, then try again.");
        }
        if (Number(network.chainId) !== deployment.chainId) {
          throw new Error(`Your wallet is not on ${chainName(deployment.chainId)}. Switch network, then try again.`);
        }
        const auction = new Contract(deployment.auction, auctionAbi, signer);
        const response = await action(auction);
        setTx({ stage: "mining", label, hash: response.hash });
        await response.wait();
        setTx({ stage: "done", label, hash: response.hash });
        await refresh();
      } catch (err) {
        setTx({ stage: "failed", label, message: describeError(err) });
      }
    },
    [wallet.provider, wallet.account, deployment, refresh]
  );

  return {
    wallet,
    theme,
    tx,
    dismissTx: () => setTx({ stage: "idle" }),
    run,
    deployment,
    supported: walletDeployment !== null,
    account,
    snapshot,
    bids,
    view,
    error,
    offline,
    refresh,
    switchTarget,
    wrongNetwork,
    switchNetwork,
    canTransact,
    isOwner,
    busy
  };
}

export type Dashboard = ReturnType<typeof useDashboard>;
