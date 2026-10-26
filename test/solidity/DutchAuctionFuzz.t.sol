// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {DutchAuction} from "../../contracts/DutchAuction.sol";
import {GavoraToken} from "../../contracts/GavoraToken.sol";

/// @notice Property-based tests: each test runs against hundreds of random inputs.
contract DutchAuctionFuzzTest is Test {
    uint256 internal constant SUPPLY = 1_000e18;
    uint256 internal constant START_PRICE = 0.02 ether;
    uint256 internal constant RESERVE_PRICE = 0.005 ether;
    uint256 internal constant DURATION = 1_200;
    uint256 internal constant BIDDERS = 6;

    GavoraToken internal token;
    DutchAuction internal auction;
    uint256 internal start;

    function setUp() public {
        token = new GavoraToken(SUPPLY, address(this));
        auction = new DutchAuction(token, SUPPLY, START_PRICE, RESERVE_PRICE, address(this));
        token.transfer(address(auction), SUPPLY);
        auction.start();
        start = auction.startTime();
    }

    receive() external payable {}

    function testFuzz_PriceIsMonotonicAndBounded(uint256 earlier, uint256 later) public view {
        earlier = bound(earlier, 0, 2 * DURATION);
        later = bound(later, earlier, 2 * DURATION);

        uint256 earlierPrice = auction.priceAt(start + earlier);
        uint256 laterPrice = auction.priceAt(start + later);

        assertLe(laterPrice, earlierPrice);
        assertLe(earlierPrice, START_PRICE);
        assertGe(laterPrice, RESERVE_PRICE);
    }

    /// Random bidders arrive at random times with random budgets. Whatever happens:
    /// - each bidder pays only for what was accepted and gets the surplus back at once,
    /// - only the bid that clears the auction can be partially accepted,
    /// - every bidder receives commitment / finalPrice tokens (one uniform price),
    /// - total claims never exceed supply and every token is claimed, burned or still held,
    /// - after the issuer withdraws, the auction holds exactly the outstanding refund credits.
    function testFuzz_SettlementIsUniformFairAndConserving(
        uint256[BIDDERS] memory amounts,
        uint256[BIDDERS] memory gaps
    ) public {
        address[BIDDERS] memory bidders;
        uint256 timestamp = start;

        for (uint256 i; i < BIDDERS; i++) {
            bidders[i] = address(uint160(0xB1D000 + i));
            timestamp += bound(gaps[i], 0, DURATION / BIDDERS);
            amounts[i] = bound(amounts[i], 1, 8 ether);

            vm.warp(timestamp);
            if (auction.status() != DutchAuction.Status.Active) {
                break;
            }

            vm.deal(bidders[i], amounts[i]);
            vm.prank(bidders[i]);
            auction.contribute{value: amounts[i]}();

            uint256 accepted = auction.commitments(bidders[i]);
            assertLe(accepted, amounts[i]);
            assertEq(bidders[i].balance, amounts[i] - accepted, "surplus not returned");
            if (accepted < amounts[i]) {
                assertTrue(auction.status() == DutchAuction.Status.Cleared, "partial fill without clearing");
            }
        }

        vm.warp(start + DURATION);
        auction.finalize();
        uint256 finalPrice = auction.finalPrice();
        assertGe(finalPrice, RESERVE_PRICE);
        assertLe(finalPrice, START_PRICE);

        uint256 claimedTotal;
        for (uint256 i; i < BIDDERS; i++) {
            uint256 commitment = auction.commitments(bidders[i]);
            if (commitment == 0) {
                continue;
            }
            vm.prank(bidders[i]);
            auction.claimTokens();
            uint256 tokens = token.balanceOf(bidders[i]);
            assertEq(tokens, (commitment * 1e18) / finalPrice, "non-uniform price");
            claimedTotal += tokens;
        }

        assertLe(claimedTotal, SUPPLY);
        assertLe(claimedTotal, auction.totalTokensSold());
        assertEq(token.balanceOf(address(auction)) + claimedTotal + auction.burnedUnsold(), SUPPLY);
        assertEq(token.totalSupply(), SUPPLY - auction.burnedUnsold());

        if (auction.totalCommitted() != 0) {
            auction.withdrawIssuerProceeds(payable(address(this)));
        }
        assertEq(address(auction).balance, auction.refundLiability());
    }

    /// A protected bid quoted at one moment and mined later, after someone else's bid, either buys at
    /// least its minimum or reverts leaving nothing changed. A fully accepted bid always meets a minimum
    /// at or below its quote, and whatever is accepted, the eventual claim covers the minimum.
    function testFuzz_ProtectedBidGetsItsMinimumOrReverts(
        uint256 earlier,
        uint256 quotedAt,
        uint256 delay,
        uint256 amount,
        uint256 minimumBps
    ) public {
        earlier = bound(earlier, 0, auction.maxCommitmentAt(START_PRICE) - 1);
        if (earlier != 0) {
            auction.contribute{value: earlier}();
        }

        quotedAt = bound(quotedAt, 0, DURATION - 1);
        vm.warp(start + quotedAt + bound(delay, 0, DURATION - 1 - quotedAt));
        if (auction.status() != DutchAuction.Status.Active) {
            return;
        }

        amount = bound(amount, 1, 8 ether);
        uint256 quote = (amount * 1e18) / auction.priceAt(start + quotedAt);
        uint256 minimum = (quote * bound(minimumBps, 0, 12_000)) / 10_000;

        uint256 room = auction.remainingCapacity();
        uint256 accepted = amount < room ? amount : room;
        uint256 tokens = (accepted * 1e18) / auction.priceAt(block.timestamp);

        address bidder = address(0xB1D0FF);
        vm.deal(bidder, amount);
        if (tokens < minimum) {
            assertTrue(accepted < amount || minimum > quote, "a full fill missed its quote");
            vm.prank(bidder);
            vm.expectRevert(abi.encodeWithSelector(DutchAuction.MinimumTokensNotMet.selector, minimum, tokens));
            auction.contributeWithMinimum{value: amount}(minimum);
            assertEq(bidder.balance, amount);
            assertEq(auction.commitments(bidder), 0);
            return;
        }

        vm.prank(bidder);
        auction.contributeWithMinimum{value: amount}(minimum);
        assertEq(auction.commitments(bidder), accepted);

        vm.warp(start + DURATION);
        auction.finalize();
        vm.prank(bidder);
        auction.claimTokens();
        assertGe(token.balanceOf(bidder), minimum, "claim below the minimum");
    }

    /// Every configuration the constructor accepts can value its whole supply at the start price, so no bid
    /// can fail on arithmetic (independent review finding P04).
    function testFuzz_AcceptedConfigurationsCanPriceTheirSupply(uint256 supply, uint256 high, uint256 low) public {
        supply = bound(supply, 1, type(uint256).max);
        high = bound(high, 2, type(uint256).max);
        low = bound(low, 1, high - 1);

        try new DutchAuction(token, supply, high, low, address(this)) returns (DutchAuction fresh) {
            fresh.maxCommitmentAt(high);
        } catch {
            // Rejected configurations are fine; only accepted ones must work.
        }
    }

    /// A single early bid that is too small to clear immediately clears later purely through
    /// falling prices, at the exact price where it buys the whole supply.
    function testFuzz_TimeClearingPriceIsExact(uint256 amount) public {
        amount = bound(amount, auction.maxCommitmentAt(RESERVE_PRICE), auction.maxCommitmentAt(START_PRICE) - 1);

        auction.contribute{value: amount}();
        vm.warp(start + DURATION);
        auction.finalize();

        uint256 expected = (amount * 1e18 + SUPPLY - 1) / SUPPLY;
        assertTrue(auction.cleared());
        assertEq(auction.finalPrice(), expected);
        assertLe(auction.totalTokensSold(), SUPPLY);
        // Rounding the price up leaves at most a sliver of supply unsold.
        assertLe(SUPPLY - auction.totalTokensSold(), SUPPLY / 1e15);
    }
}
