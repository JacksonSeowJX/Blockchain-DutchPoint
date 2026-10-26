import { getAddress, isAddress } from "ethers";
import { useState } from "react";

import { Position } from "../hooks/useAuction";
import { Status, View, tokensFor } from "../lib/auctionMath";
import { formatEth, formatToken, percent } from "../lib/format";

type Props = {
  view: View;
  position: Position;
  finalPrice: bigint;
  saleSupply: bigint;
  /** The connected wallet: the default refund recipient. */
  account: string;
  busy: boolean;
  onClaim: () => void;
  /** Withdraws the held refund to `recipient` (the contract's withdrawRefundTo). */
  onWithdrawRefund: (recipient: string) => void;
  /** Lists GVRA in the connected wallet; resolves true if the user accepted. */
  onAddToken: () => Promise<boolean>;
};

export function PositionPanel({
  view,
  position,
  finalPrice,
  saleSupply,
  account,
  busy,
  onClaim,
  onWithdrawRefund,
  onAddToken
}: Props) {
  const [tokenAdded, setTokenAdded] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  // Empty means "my connected wallet"; another address helps when that wallet cannot receive ETH.
  const recipient = recipientInput.trim() === "" ? account : recipientInput.trim();
  const recipientValid = isAddress(recipient);
  const finalized = view.status === Status.Finalized;
  const owed = tokensFor(position.commitment, finalized ? finalPrice : view.price);
  const hasBid = position.commitment > 0n;
  const allocation = position.claimed ? position.tokensClaimed : owed;

  return (
    <section className="card">
      <h2>Your position</h2>
      {!hasBid && position.refundCredit === 0n ? (
        <p className="muted">You haven't bid in this auction yet.</p>
      ) : (
        <dl className="rows">
          <div>
            <dt>ETH committed</dt>
            <dd>{formatEth(position.commitment)}</dd>
          </div>
          <div>
            <dt>{finalized ? "GVRA allocation" : "GVRA allocation (at least)"}</dt>
            <dd>{formatToken(allocation)}</dd>
          </div>
          <div>
            <dt>{finalized ? "Share of supply" : "Share of supply (at least)"}</dt>
            <dd>{percent(allocation, saleSupply).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>GVRA in wallet</dt>
            <dd>{formatToken(position.tokenBalance)}</dd>
          </div>
          {position.refundCredit > 0n && (
            <div>
              <dt>Refund waiting</dt>
              <dd>{formatEth(position.refundCredit)}</dd>
            </div>
          )}
        </dl>
      )}

      {hasBid && finalized && !position.claimed && (
        <button className="btn primary wide" onClick={onClaim} disabled={busy}>
          Claim {formatToken(owed)}
        </button>
      )}
      {hasBid && position.claimed && <p className="callout success">Claimed. Your GVRA is in your wallet.</p>}
      {hasBid && !finalized && (
        <p className="hint">
          Claims open after the 20-minute window ends and anyone finalizes the auction.
        </p>
      )}
      {hasBid && (
        <button
          className="btn wide"
          onClick={() => void onAddToken().then((added) => setTokenAdded(added))}
          disabled={tokenAdded}
        >
          {tokenAdded ? "GVRA added to your wallet" : "Add GVRA to your wallet"}
        </button>
      )}
      {position.refundCredit > 0n && (
        <div className="refund">
          <label className="field">
            <span>Send refund to</span>
            <input
              value={recipientInput}
              onChange={(event) => setRecipientInput(event.target.value)}
              placeholder={account}
              spellCheck={false}
              aria-invalid={!recipientValid}
            />
          </label>
          {!recipientValid && <p className="field-error">Enter a valid Ethereum address.</p>}
          <p className="hint">
            Your wallet refused the automatic refund. Leave this empty to try your connected wallet again, or
            enter another address you control.
          </p>
          <button
            className="btn wide"
            onClick={() => onWithdrawRefund(getAddress(recipient))}
            disabled={busy || !recipientValid}
          >
            Withdraw {formatEth(position.refundCredit)} refund
          </button>
        </div>
      )}
    </section>
  );
}
