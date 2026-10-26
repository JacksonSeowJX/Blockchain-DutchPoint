// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {DutchAuction} from "../../contracts/DutchAuction.sol";
import {GavoraToken} from "../../contracts/GavoraToken.sol";
import {RejectingReceiver, IAuctionForRejectingReceiver} from "../../contracts/mocks/RejectingReceiver.sol";

/// @notice Drives the auction through random sequences of bids, time jumps, finalization,
///         claims and withdrawals. The fuzzer calls these functions in random order.
contract AuctionHandler is Test {
    uint256 public constant SUPPLY = 1_000e18;

    GavoraToken public token;
    DutchAuction public auction;
    RejectingReceiver public rejecter;
    address[] internal actors;

    /// Ghost counter: claims that did not match commitment / finalPrice.
    uint256 public nonUniformClaims;
    /// Ghost: ETH forced into the auction without calling it (a selfdestruct payout, a block reward).
    uint256 public forcedEth;
    /// Ghost: GVRA that holders burned themselves after claiming (ERC20Burnable lets anyone burn their own).
    uint256 public holderBurned;

    constructor() {
        token = new GavoraToken(SUPPLY, address(this));
        auction = new DutchAuction(token, SUPPLY, 0.02 ether, 0.005 ether, address(this));
        token.transfer(address(auction), SUPPLY);
        auction.start();
        rejecter = new RejectingReceiver(IAuctionForRejectingReceiver(address(auction)));
        for (uint256 i; i < 5; i++) {
            actors.push(address(uint160(0xA11CE0 + i)));
        }
    }

    receive() external payable {}

    function contribute(uint256 actorSeed, uint256 amount) external {
        if (auction.status() != DutchAuction.Status.Active) {
            return;
        }
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 6 ether);
        vm.deal(actor, actor.balance + amount);
        vm.prank(actor);
        auction.contribute{value: amount}();
    }

    /// A contract bidder that rejects ETH, so crossing surpluses become refund credits.
    function contributeAsRejecter(uint256 amount) external {
        if (auction.status() != DutchAuction.Status.Active) {
            return;
        }
        amount = bound(amount, 1, 6 ether);
        vm.deal(address(this), address(this).balance + amount);
        rejecter.contribute{value: amount}();
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 400));
    }

    function finalize() external {
        if (auction.status() == DutchAuction.Status.AwaitingFinalization) {
            auction.finalize();
        }
    }

    function claim(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        if (!auction.finalized() || auction.commitments(actor) == 0 || auction.claimed(actor)) {
            return;
        }
        uint256 before = token.balanceOf(actor);
        vm.prank(actor);
        auction.claimTokens();
        uint256 expected = (auction.commitments(actor) * 1e18) / auction.finalPrice();
        if (token.balanceOf(actor) - before != expected) {
            nonUniformClaims += 1;
        }
    }

    function withdrawRejecterRefund() external {
        if (auction.refundCredits(address(rejecter)) != 0) {
            rejecter.withdrawTo(payable(address(0xBEEF)));
        }
    }

    /// Unsolicited ETH can reach any address without running its code. No function may pay it out.
    function forceEth(uint256 amount) external {
        amount = bound(amount, 1, 2 ether);
        vm.deal(address(auction), address(auction).balance + amount);
        forcedEth += amount;
    }

    /// A holder burns some of their own claimed GVRA, which lowers totalSupply outside the auction.
    function burnOwnTokens(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 balance = token.balanceOf(actor);
        if (balance == 0) {
            return;
        }
        amount = bound(amount, 1, balance);
        vm.prank(actor);
        token.burn(amount);
        holderBurned += amount;
    }

    function withdrawProceeds() external {
        if (auction.finalized() && auction.totalCommitted() > auction.issuerProceedsWithdrawn()) {
            auction.withdrawIssuerProceeds(payable(address(this)));
        }
    }
}

contract DutchAuctionInvariantTest is Test {
    AuctionHandler internal handler;
    DutchAuction internal auction;
    GavoraToken internal token;

    function setUp() public {
        handler = new AuctionHandler();
        auction = handler.auction();
        token = handler.token();
        targetContract(address(handler));
    }

    /// The auction always holds at least what it owes: the unwithdrawn proceeds plus outstanding refund
    /// credits. Anything above that can only be ETH forced in from outside, which nothing pays out, so
    /// the balance is exactly what is owed plus that forced ETH.
    function invariant_EthIsFullyBacked() public view {
        uint256 owed = auction.totalCommitted() - auction.issuerProceedsWithdrawn() + auction.refundLiability();
        assertGe(address(auction).balance, owed);
        assertEq(address(auction).balance, owed + handler.forcedEth());
    }

    /// Every GVRA unit of the sale is held by the auction, claimed, or burned - nothing else.
    function invariant_TokensAreConserved() public view {
        uint256 supply = handler.SUPPLY();
        assertEq(token.balanceOf(address(auction)) + auction.totalTokensClaimed() + auction.burnedUnsold(), supply);
        // Holders may also burn their own claimed GVRA; the auction's accounting is unaffected by that.
        assertEq(token.totalSupply(), supply - auction.burnedUnsold() - handler.holderBurned());
    }

    /// Committed ETH can never buy more than the sale supply at the price that applies to it.
    function invariant_DemandNeverExceedsSupply() public view {
        if (auction.finalized()) {
            assertLe(auction.totalTokensSold(), handler.SUPPLY());
            assertLe(auction.totalTokensClaimed(), auction.totalTokensSold());
            return;
        }
        (bool isCleared, uint256 price, ) = auction.clearingState();
        uint256 applicablePrice = isCleared ? price : auction.priceAt(block.timestamp);
        assertLe(auction.totalCommitted(), auction.maxCommitmentAt(applicablePrice));
    }

    function invariant_ClaimsUseOneUniformPrice() public view {
        assertEq(handler.nonUniformClaims(), 0);
    }
}
