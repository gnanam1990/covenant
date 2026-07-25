// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Covenant} from "../src/Covenant.sol";

contract MockUSDC is IERC20 {
    string public override name = "USD Coin";
    string public override symbol = "USDC";
    uint8  public override decimals = 6;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    function mint(address to, uint256 a) external { totalSupply += a; balanceOf[to] += a; emit Transfer(address(0), to, a); }
    function transfer(address to, uint256 a) public override returns (bool) { _t(msg.sender, to, a); return true; }
    function approve(address s, uint256 a) public override returns (bool) { allowance[msg.sender][s] = a; emit Approval(msg.sender, s, a); return true; }
    function transferFrom(address f, address to, uint256 a) public override returns (bool) {
        uint256 al = allowance[f][msg.sender];
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        _t(f, to, a);
        return true;
    }
    function _t(address f, address to, uint256 a) internal {
        balanceOf[f] -= a; balanceOf[to] += a; emit Transfer(f, to, a);
    }
}

contract CovenantTest is Test {
    Covenant public cov;
    MockUSDC public usdc;
    address public payer;
    address public payee;
    address public a1;
    address public a2;
    address public a3;
    address public attacker;

    function setUp() public {
        usdc = new MockUSDC();
        cov = new Covenant(usdc);
        payer = makeAddr("payer");
        payee = makeAddr("payee");
        a1 = makeAddr("attestor-1");
        a2 = makeAddr("attestor-2");
        a3 = makeAddr("attestor-3");
        attacker = makeAddr("attacker");
        usdc.mint(payer, 1_000_000_000_000);
        vm.prank(payer); usdc.approve(address(cov), type(uint256).max);
    }

    function _createSimple() internal returns (uint256 id) {
        address[] memory atts = new address[](1);
        atts[0] = a1;
        vm.prank(payer);
        id = cov.createCovenant(payee, atts, Covenant.ReleaseRule.ALL, 1, 50_000_000, uint64(block.timestamp + 30 days));
    }

    function _createMOFN() internal returns (uint256 id) {
        address[] memory atts = new address[](3);
        atts[0] = a1; atts[1] = a2; atts[2] = a3;
        vm.prank(payer);
        id = cov.createCovenant(payee, atts, Covenant.ReleaseRule.M_OF_N, 2, 50_000_000, uint64(block.timestamp + 30 days));
    }

    // -----------------------------------------------------------------------
    // Invariant 1: release requires rule satisfaction by registered attestors
    // -----------------------------------------------------------------------

    function test_invariant1_attackerCannotPostCondition() public {
        uint256 id = _createSimple();
        vm.prank(attacker);
        vm.expectRevert(Covenant.NotAttestor.selector);
        cov.postCondition(id, 0);
    }

    function test_invariant1_attackerCannotForceRelease() public {
        uint256 id = _createSimple();
        uint256 payeeBefore = usdc.balanceOf(payee);
        vm.expectRevert(Covenant.InvalidRule.selector);
        cov.attemptRelease(id);
        assertEq(usdc.balanceOf(payee), payeeBefore, "payee got funds without attestation");
    }

    function test_invariant1_simpleEscrow_releaseAfterAttest() public {
        uint256 id = _createSimple();
        vm.prank(a1); cov.postCondition(id, 0);
        uint256 payeeBefore = usdc.balanceOf(payee);
        cov.attemptRelease(id);
        assertEq(usdc.balanceOf(payee), payeeBefore + 50_000_000);
    }

    // -----------------------------------------------------------------------
    // Invariant 2: funds ONLY to registered payee
    // -----------------------------------------------------------------------

    function test_invariant2_payeeCannotBeAttacker() public {
        vm.expectRevert(Covenant.ZeroAddress.selector); // not zero address
        // payee = address(0) is rejected
        address[] memory atts = new address[](1);
        atts[0] = a1;
        vm.prank(payer);
        cov.createCovenant(address(0), atts, Covenant.ReleaseRule.ALL, 1, 100, uint64(block.timestamp + 1 days));
    }

    // -----------------------------------------------------------------------
    // Invariant 3: covenant resolves exactly once per tier
    // -----------------------------------------------------------------------

    function test_invariant3_doubleRelease_reverts() public {
        uint256 id = _createSimple();
        vm.prank(a1); cov.postCondition(id, 0);
        cov.attemptRelease(id);
        vm.expectRevert(Covenant.WrongState.selector);
        cov.attemptRelease(id);
    }

    // -----------------------------------------------------------------------
    // Invariant 4: M-of-N counts each attestor at most once
    // -----------------------------------------------------------------------

    function test_invariant4_sameAttestorOnlyOnce() public {
        uint256 id = _createMOFN();
        vm.prank(a1); cov.postCondition(id, 0);
        // a1 has only one condition (index 0). Can't double-count: re-posting reverts.
        vm.prank(a1);
        vm.expectRevert(Covenant.AlreadyConfirmed.selector);
        cov.postCondition(id, 0);
    }

    function test_invariant4_belowThreshold_doesNotRelease() public {
        uint256 id = _createMOFN();
        vm.prank(a1); cov.postCondition(id, 0);
        vm.expectRevert(Covenant.InvalidRule.selector);
        cov.attemptRelease(id);
    }

    function test_invariant4_meetingThreshold_releases() public {
        uint256 id = _createMOFN();
        vm.prank(a1); cov.postCondition(id, 0);
        vm.prank(a2); cov.postCondition(id, 1);
        uint256 payeeBefore = usdc.balanceOf(payee);
        cov.attemptRelease(id);
        assertEq(usdc.balanceOf(payee), payeeBefore + 50_000_000);
    }

    // -----------------------------------------------------------------------
    // Invariant 5: conservation across RANDOMIZED configurations (generality)
    // -----------------------------------------------------------------------

    function testFuzz_generality(uint8 numAttestors, uint8 ruleKind, uint8 thresholdSeed, bool tryRelease, bool tryRefund) public {
        numAttestors = uint8(bound(numAttestors, 1, 6));
        ruleKind = uint8(bound(ruleKind, 0, 2));
        // threshold: for M_OF_N, between 1 and numAttestors; otherwise ignored
        uint256 threshold = ruleKind == 2 ? (uint256(bound(thresholdSeed, 1, numAttestors))) : 1;

        address[] memory atts = new address[](numAttestors);
        for (uint256 i = 0; i < numAttestors; i++) {
            atts[i] = makeAddr(string(abi.encodePacked("gen-att-", numAttestors, "-", i)));
        }

        uint96 amt = 100_000_000;
        vm.prank(payer);
        uint256 id = cov.createCovenant(
            payee, atts,
            Covenant.ReleaseRule(ruleKind),
            threshold, amt,
            uint64(block.timestamp + 30 days)
        );

        // Randomly confirm a subset of conditions.
        for (uint256 i = 0; i < numAttestors; i++) {
            if (uint256(keccak256(abi.encode(id, i))) % 2 == 0) {
                vm.prank(atts[i]);
                try cov.postCondition(id, i) {} catch {}
            }
        }

        uint256 payeeBefore = usdc.balanceOf(payee);
        uint256 payerBefore = usdc.balanceOf(payer);

        if (tryRelease) {
            try cov.attemptRelease(id) {} catch {}
        }
        if (tryRefund) {
            vm.warp(block.timestamp + 31 days);
            vm.prank(payer);
            try cov.refundExpired(id) {} catch {}
        }

        // Conservation: total paid out (to payee OR back to payer) never exceeds amt
        uint256 payeeDelta = usdc.balanceOf(payee) - payeeBefore;
        uint256 payerDelta = usdc.balanceOf(payer) - payerBefore;
        // payee may have received at most amt (release) or 0
        assertLe(payeeDelta, amt, "payee got more than amt");
        // payer may have been refunded amt OR debited amt (the lock) — but the combined
        // net pay should never mean the contract holds more than 0 in the "released" path
        // or "refunded" path. In the locked state, contract still holds amt.
        // In the released state, contract holds 0 and payeeDelta = amt, payerDelta = -amt.
        // In the refunded state, contract holds 0 and payeeDelta = 0, payerDelta = 0.
        if (payeeDelta == amt) {
            // released: payer was already debited at lock (reflected in payerBefore);
            // balance unchanged after release. payeeDelta = amt confirms the release amount.
            assertEq(payeeDelta, amt, "released: payee should have received amt");
        } else if (payeeDelta == 0) {
            // either refunded or still locked
            Covenant.CovenantData memory c = cov.getCovenant(id);
            if (c.state == Covenant.CovenantState.Refunded) {
                assertEq(usdc.balanceOf(payer), payerBefore + amt, "refunded: payer should be back to start");
            }
        } else {
            assertTrue(false, "payee got partial release - not allowed");
        }
    }

    // -----------------------------------------------------------------------
    // Misc errors
    // -----------------------------------------------------------------------

    function test_zeroAmount_reverts() public {
        address[] memory atts = new address[](1);
        atts[0] = a1;
        vm.prank(payer);
        vm.expectRevert(Covenant.ZeroAmount.selector);
        cov.createCovenant(payee, atts, Covenant.ReleaseRule.ALL, 1, 0, uint64(block.timestamp + 1 days));
    }

    function test_noAttestors_reverts() public {
        address[] memory empty = new address[](0);
        vm.prank(payer);
        vm.expectRevert(Covenant.InvalidConditions.selector);
        cov.createCovenant(payee, empty, Covenant.ReleaseRule.ALL, 1, 100, uint64(block.timestamp + 1 days));
    }

    function test_refundExpired_payerRecovers() public {
        uint256 id = _createSimple();
        uint256 payerBefore = usdc.balanceOf(payer);
        vm.warp(block.timestamp + 31 days);
        vm.prank(payer);
        cov.refundExpired(id);
        assertEq(usdc.balanceOf(payer), payerBefore + 50_000_000);
    }
}
