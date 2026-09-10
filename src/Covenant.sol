// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "forge-std/interfaces/IERC20.sol";

library SafeTransferLib {
    error TransferFailed();
    function safeTransferFrom(IERC20 t, address f, address to, uint256 a) internal {
        (bool ok, bytes memory d) = address(t).call(abi.encodeWithSelector(IERC20.transferFrom.selector, f, to, a));
        if (!ok || (d.length != 0 && !abi.decode(d, (bool)))) revert TransferFailed();
    }
    function safeTransfer(IERC20 t, address to, uint256 a) internal {
        (bool ok, bytes memory d) = address(t).call(abi.encodeWithSelector(IERC20.transfer.selector, to, a));
        if (!ok || (d.length != 0 && !abi.decode(d, (bool)))) revert TransferFailed();
    }
}

/// @title Covenant
/// @notice The universal conditional-release primitive.
///
/// A covenant is created with:
///   - payer, payee (registered parties; payer pays, payee is release destination)
///   - conditions: list of (attestor address) tuples. Each condition is
///     "attestor X has posted a value."
///   - releaseRule: ALL, ANY, or M-of-N
///   - amount + expiry
///
/// DESIGN NOTE (bool-only value): `postCondition` takes a `bool value` — the
/// attestor's outcome vote for their slot. Only a `true` outcome counts toward
/// the release rule; a `false` vote is recorded (proof the attestor spoke) but
/// never releases funds. A richer value type (threshold/comparator per PRD §2)
/// is deliberately deferred: binary outcomes already express escrow,
/// parametric-trigger, and tranche shapes, and an unused generic payload
/// would widen the audit surface for no MVP gain.
///
/// SYBIL RESISTANCE: attestors must be distinct from each other and from the
/// payer/payee (enforced at create). At posting time `hasConfirmed[id][who]`
/// is read before any state change, so one address can confirm at most once
/// per covenant even if it somehow held N slots.
///
/// Generic enough to express: simple escrow, parametric trigger, multi-attestor
/// tranche release, tiered-outcome payment — through configuration alone.
contract Covenant {
    using SafeTransferLib for IERC20;

    enum ReleaseRule { ALL, ANY, M_OF_N }

    enum CovenantState { Active, Released, Refunded }

    /// A condition is "attestor X has confirmed (with a bool outcome)".
    /// `confirmed` records that the attestor spoke; `outcome` is their vote.
    /// Only `confirmed && outcome` counts toward the release rule.
    struct Condition {
        address attestor;
        bool    confirmed;
        bool    outcome;
    }

    struct CovenantData {
        address payer;
        address payee;
        uint96  amount;
        uint64  expiry;
        ReleaseRule rule;
        uint256 threshold;     // for M_OF_N: required count
        Condition[] conditions;
        CovenantState state;
    }

    IERC20 public immutable usdc;
    mapping(uint256 => CovenantData) public covenants;
    uint256 public nextId;

    // Per-covenant counter for distinct-attestor confirmation enforcement
    mapping(uint256 => mapping(address => bool)) public hasConfirmed;

    event CovenantCreated(uint256 indexed id, address indexed payer, address indexed payee, uint96 amount, uint8 rule, uint256 threshold, uint64 expiry);
    event ConditionPosted(uint256 indexed id, uint256 indexed conditionIndex, address indexed attestor);
    event Released(uint256 indexed id, address indexed payee, uint96 amount);
    event Refunded(uint256 indexed id, address indexed payer, uint96 amount);

    error UnknownCovenant();
    error WrongState();
    error NotAttestor();
    error NotPayer();
    error ZeroAddress();
    error ZeroAmount();
    error ExpiryMustBeFuture();
    error InvalidConditions();
    error AlreadyConfirmed();
    error InvalidRule();
    error ExpiryNotReached();
    error AttestorIsParty();
    error DuplicateAttestor();

    constructor(IERC20 _usdc) {
        if (address(_usdc) == address(0)) revert ZeroAddress();
        usdc = _usdc;
    }

    function createCovenant(
        address payee,
        address[] calldata attestors,
        ReleaseRule rule,
        uint256 threshold,
        uint96  amount,
        uint64  expiry
    ) external returns (uint256 id) {
        if (payee == address(0)) revert ZeroAddress();
        if (attestors.length == 0) revert InvalidConditions();
        if (amount == 0) revert ZeroAmount();
        if (expiry <= block.timestamp) revert ExpiryMustBeFuture();
        if (rule == ReleaseRule.M_OF_N && (threshold == 0 || threshold > attestors.length)) revert InvalidRule();

        id = nextId++;
        CovenantData storage c = covenants[id];
        c.payer = msg.sender;
        c.payee = payee;
        c.amount = amount;
        c.expiry = expiry;
        c.rule = rule;
        c.threshold = threshold;
        for (uint256 i = 0; i < attestors.length; i++) {
            if (attestors[i] == address(0)) revert ZeroAddress();
            if (attestors[i] == msg.sender || attestors[i] == payee) revert AttestorIsParty();
            for (uint256 j = 0; j < i; j++) {
                if (attestors[i] == attestors[j]) revert DuplicateAttestor();
            }
            c.conditions.push(Condition({attestor: attestors[i], confirmed: false, outcome: false}));
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit CovenantCreated(id, msg.sender, payee, amount, uint8(rule), threshold, expiry);
    }

    /// @notice Registered attestor for conditionIndex posts their outcome vote.
    /// @param value The attestor's outcome: true counts toward release, false is
    ///        recorded but never releases (lets an attestor go on record as "no"
    ///        without moving funds).
    function postCondition(uint256 id, uint256 conditionIndex, bool value) external {
        CovenantData storage c = _active(id);
        if (conditionIndex >= c.conditions.length) revert InvalidConditions();
        // Sybil guard FIRST: one address confirms at most once per covenant,
        // even across slots. Checked before role so a cross-slot replay reverts
        // as AlreadyConfirmed (double-count attempt), not NotAttestor.
        if (hasConfirmed[id][msg.sender]) revert AlreadyConfirmed();
        Condition storage cond = c.conditions[conditionIndex];
        if (msg.sender != cond.attestor) revert NotAttestor();
        if (cond.confirmed) revert AlreadyConfirmed();

        cond.confirmed = true;
        cond.outcome = value;
        hasConfirmed[id][msg.sender] = true;
        emit ConditionPosted(id, conditionIndex, msg.sender);
    }

    /// @notice Permissionless trigger — evaluates whether the release rule is currently
    ///         satisfied; pays out only if so.
    function attemptRelease(uint256 id) external {
        CovenantData storage c = _active(id);
        if (!_ruleSatisfied(c)) revert InvalidRule();
        c.state = CovenantState.Released;
        usdc.safeTransfer(c.payee, c.amount);
        emit Released(id, c.payee, c.amount);
    }

    function refundExpired(uint256 id) external {
        CovenantData storage c = _active(id);
        if (msg.sender != c.payer) revert NotPayer();
        if (block.timestamp <= c.expiry) revert ExpiryNotReached();
        c.state = CovenantState.Refunded;
        usdc.safeTransfer(c.payer, c.amount);
        emit Refunded(id, c.payer, c.amount);
    }

    // -----------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------

    function getCovenant(uint256 id) external view returns (CovenantData memory) {
        return covenants[id];
    }

    function isAttestor(uint256 id, address who) public view returns (bool) {
        CovenantData storage c = covenants[id];
        for (uint256 i = 0; i < c.conditions.length; i++) {
            if (c.conditions[i].attestor == who) return true;
        }
        return false;
    }

    function conditionCount(uint256 id) external view returns (uint256) {
        return covenants[id].conditions.length;
    }

    // -----------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------

    function _active(uint256 id) internal view returns (CovenantData storage) {
        CovenantData storage c = covenants[id];
        if (c.payer == address(0)) revert UnknownCovenant();
        if (c.state != CovenantState.Active) revert WrongState();
        return c;
    }

    function _ruleSatisfied(CovenantData storage c) internal view returns (bool) {
        uint256 confirmed = 0;
        for (uint256 i = 0; i < c.conditions.length; i++) {
            if (c.conditions[i].confirmed && c.conditions[i].outcome) confirmed++;
        }
        if (c.rule == ReleaseRule.ALL) return confirmed == c.conditions.length;
        if (c.rule == ReleaseRule.ANY) return confirmed > 0;
        // M_OF_N
        return confirmed >= c.threshold;
    }
}
