# Covenant — universal conditional-release primitive on Arc

Covenant is a single, configurable onchain primitive: funds lock, registered
attestors post conditions, funds release or refund. One audited core expresses
simple escrow, parametric triggers, and multi-attestor tranche release
through configuration alone — no per-vertical redeploy.

> **Unaudited testnet software — no real funds.** The contract enforces the
> *process* around attestations, never the *truth* of an attestation.
> Attestor honesty is out of scope.

## Network — Arc Testnet

| Item | Value |
|------|-------|
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| USDC (native testnet) | `0x3600000000000000000000000000000000000000` (6 decimals) |

## Contract API (`src/Covenant.sol`)

```solidity
function createCovenant(
  address payee,
  address[] calldata attestors,
  ReleaseRule rule,
  uint256 threshold,
  uint96 amount,
  uint64 expiry
) external returns (uint256 id);

function postCondition(uint256 id, uint256 conditionIndex, bool value) external;
function attemptRelease(uint256 id) external;
function refundExpired(uint256 id) external;
```

Release rules:

- `ALL` — every registered attestor must confirm.
- `ANY` — any single confirmation suffices.
- `M_OF_N` — `threshold` of `N` attestors must confirm (each attestor counted at most once; double-post reverts).

Notes:

- `postCondition` — only the registered attestor for that `conditionIndex` may call, at most once per covenant (`hasConfirmed` is read before any state change, so one address can never double-count via N slots). `value` is the outcome vote: `true` counts toward the release rule, `false` is recorded but never releases.
- `createCovenant` — rejects payer/payee as attestor and duplicate attestors (distinct-attestor enforcement; stricter than PROMPT invariant 1's "unless explicitly configured" allowance — no configuration path re-enables self-attestation in v1).
- `attemptRelease` — permissionless; reverts unless the rule is currently satisfied. Pays the registered `payee` only.
- `refundExpired` — only `payer`, only after `expiry`. Refunds the `payer` only.
- Each covenant resolves exactly once (`Released` or `Refunded`).

## Reference configurations (same contract, three shapes)

| # | Config | Rule | Attestors | Function |
|---|--------|------|-----------|----------|
| 1 | Simple two-party escrow | `ALL` | 1 | `configEscrow()` in `services/config-escrow.ts` |
| 2 | Parametric insurance (one oracle) | `ANY` | 1 oracle | `configParametric()` in `services/config-parametric.ts` |
| 3 | Multi-attestor tranche | `M_OF_N` (2-of-3) | 3 | `configTranche()` in `services/config-tranche.ts` |

Shared wiring (single `COV_ADDRESS`, `PAYEE_ADDRESS` payee, `CovenantCreated`-log receipt parsing) lives in `services/shared.ts`; `services/configs.ts` is a deprecated re-export shim.

All three run against the **same** `COV_ADDRESS`. `services/demo.ts` runs all three and prints that shared address.

## Quickstart

```bash
forge build
forge test
```

Expected: `17/17 PASS` (12 invariant + 5 sybil/value tests, incl. 512-run generality fuzz over attestor count 1–6 + rule ALL/ANY/M-of-N + threshold).

```bash
npm test
```

Off-chain config tests (`services/test/configs.test.ts`, 5 tests): same-address + distinct-rules + env-payee + `CovenantCreated`-log parsing checks, no network.

### Env + deploy + demo (Arc testnet)

```bash
cp .env.example .env
# fill in PRIVATE_KEY, PAYER_KEY, ORACLE_KEY,
# ATTESTOR1_KEY, ATTESTOR2_KEY, ATTESTOR3_KEY, COV_ADDRESS, etc.
source .env 2>/dev/null || export $(grep -v '^#' .env | xargs)

forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC --broadcast

# then, against the single deployed address:
COV_ADDRESS=0x... npm run demo
# or single config: COV_ADDRESS=0x... npx tsx services/demo.ts 1|2|3
```

See `docs/addresses.md` for deployment log, fork validation, and lifecycle proof.
`broadcast/Deploy.s.sol/5042002/run-latest.json` records the deploy.

## Repo layout

- `src/Covenant.sol` — core primitive.
- `test/Covenant.t.sol` — 17 invariant + fuzz + sybil tests.
- `services/shared.ts` — shared RPC/ABI/receipt-parsing wiring (single `COV_ADDRESS`).
- `services/config-escrow.ts`, `services/config-parametric.ts`, `services/config-tranche.ts` — three reference configs.
- `services/configs.ts` — deprecated re-export shim.
- `services/demo.ts` — CLI demo (`all|1|2|3`).
- `script/Deploy.s.sol` — deploy script (`PRIVATE_KEY`, `USDC_ADDRESS` from env).
- `docs/addresses.md` — addresses + lifecycle proof.
- `docs/PRD.md` — PRD.

## Honesty

- Unaudited, testnet only.
- Real transactions only for lifecycle proof; fork validation documented where real deploy is pending a funded key.
- Never claims truth of attestations — only process (registered attestor, rule satisfied, exact-once, payee/payer-only, conservation).
