import { Bid } from "../hooks/useAuction";
import { TOKEN_SCALE } from "../lib/auctionMath";
import { formatEth, formatPrice, secondsToClock, shortAddress } from "../lib/format";
import { ExternalIcon } from "./icons";

type Props = {
  bids: Bid[];
  saleSupply: bigint;
  startTime: bigint;
  account: string | null;
  explorer: string | null;
  auction: string | null;
  /** Some of the history could not be read from the network; the hook keeps retrying. */
  historyUnavailable: boolean;
};

export function BidHistory({ bids, saleSupply, startTime, account, explorer, auction, historyUnavailable }: Props) {
  const explorerLink = explorer && auction && (
    <>
      {" "}
      <a href={`${explorer}/address/${auction}`} target="_blank" rel="noreferrer">
        See the bids on Etherscan <ExternalIcon />
      </a>
    </>
  );

  if (bids.length === 0) {
    return historyUnavailable ? (
      <p className="empty">
        The bid history couldn't be loaded from the network right now. DutchPoint keeps retrying.
        {explorerLink}
      </p>
    ) : (
      <p className="empty">No bids yet. The first bid will appear here.</p>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="bids">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Bidder</th>
              <th scope="col" className="num">Price</th>
              <th scope="col" className="num">Accepted</th>
              <th scope="col" className="num">Surplus</th>
            </tr>
          </thead>
          <tbody>
            {[...bids].reverse().map((bid) => {
              const refunded = bid.amount - bid.accepted;
              // The bid that fills the supply at its price is the one that cleared the auction.
              const clearedAuction = bid.totalCommitted >= (saleSupply * bid.price) / TOKEN_SCALE;
              const mine = account !== null && bid.account.toLowerCase() === account.toLowerCase();
              const elapsed = bid.timestamp > startTime ? bid.timestamp - startTime : 0n;
              return (
                <tr key={bid.key} className={mine ? "mine" : undefined}>
                  <td>
                    {explorer ? (
                      <a
                        href={`${explorer}/tx/${bid.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        title="View this transaction on the block explorer"
                      >
                        {secondsToClock(elapsed)} <ExternalIcon />
                      </a>
                    ) : (
                      secondsToClock(elapsed)
                    )}
                  </td>
                  <td>
                    {mine ? "You" : shortAddress(bid.account)}
                    {clearedAuction && <span className="tag">Cleared</span>}
                  </td>
                  <td className="num">{formatPrice(bid.price)}</td>
                  <td className="num">{formatEth(bid.accepted)}</td>
                  <td className="num">
                    {refunded > 0n ? (
                      <>
                        {formatEth(refunded)}{" "}
                        {bid.surplusCredited ? (
                          <span className="tag held" title="The bidder's wallet refused the ETH, so the auction holds it for them to withdraw">
                            held
                          </span>
                        ) : (
                          <span className="tag returned" title="Sent back in the same transaction">
                            returned
                          </span>
                        )}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {historyUnavailable && (
        <p className="hint">
          Newer bids couldn't be loaded right now. DutchPoint keeps retrying.
          {explorerLink}
        </p>
      )}
      {explorer && <p className="hint">Click a bid's time to see its transaction on Etherscan.</p>}
    </>
  );
}
