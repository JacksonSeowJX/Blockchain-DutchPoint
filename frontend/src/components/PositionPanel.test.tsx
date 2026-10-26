import { fireEvent, render, screen } from "@testing-library/react";
import { parseEther, parseUnits } from "ethers";
import { describe, expect, it, vi } from "vitest";

import { position, viewAfter } from "../test/fixtures";
import { PositionPanel } from "./PositionPanel";

const BIDDER = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const OTHER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function renderPanel() {
  const onWithdrawRefund = vi.fn();
  render(
    <PositionPanel
      view={viewAfter(700n)}
      position={position({ commitment: parseEther("0.25"), refundCredit: parseEther("0.75") })}
      finalPrice={0n}
      saleSupply={parseUnits("1000", 18)}
      account={BIDDER}
      busy={false}
      onClaim={vi.fn()}
      onWithdrawRefund={onWithdrawRefund}
      onAddToken={vi.fn(async () => true)}
    />
  );
  return onWithdrawRefund;
}

const withdrawButton = () => screen.getByRole("button", { name: /refund/i }) as HTMLButtonElement;

// Codex audit finding A7: if the bidder's own wallet rejects ETH, the refund must be sendable elsewhere.
describe("PositionPanel refund recipient", () => {
  it("A7: sends a held refund to another address when one is entered", () => {
    const onWithdrawRefund = renderPanel();
    fireEvent.change(screen.getByLabelText("Send refund to"), { target: { value: OTHER.toLowerCase() } });
    fireEvent.click(withdrawButton());
    expect(onWithdrawRefund).toHaveBeenCalledWith(OTHER);
  });

  it("A7: defaults to the connected account", () => {
    const onWithdrawRefund = renderPanel();
    fireEvent.click(withdrawButton());
    expect(onWithdrawRefund).toHaveBeenCalledWith(BIDDER);
  });

  it("A7: refuses an invalid address", () => {
    const onWithdrawRefund = renderPanel();
    fireEvent.change(screen.getByLabelText("Send refund to"), { target: { value: "0x1234" } });
    expect(screen.getByText("Enter a valid Ethereum address.")).toBeTruthy();
    expect(withdrawButton().disabled).toBe(true);
    fireEvent.click(withdrawButton());
    expect(onWithdrawRefund).not.toHaveBeenCalled();
  });
});
