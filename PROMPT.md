# Covenant — staged Claude Code build prompts

Read docs/PRD.md fully first. This is the most abstract project in the batch — resist the temptation to over-generalize beyond what §2 actually specifies.

---
## STAGE 1 — Core contract (Covenant)

Foundry, tests before implementation.

INVARIANTS:
1. Release requires the configured release rule (ALL/ANY/M-of-N) to be satisfied by registered attestors' postings — never satisfiable by an unregistered address or by the payer/payee themselves acting as their own attestor unless explicitly configured that way.
2. Funds release ONLY to the registered payee, or refund ONLY to the registered payer — no free-text destination, ever, regardless of configuration.
3. A covenant resolves exactly once per configured tier — no double-release.
4. An M-of-N release rule counts each attestor's confirmation at most once, even if they attempt to post multiple times.
5. Conservation: fuzz across randomized covenant configurations (varying condition counts, release rules, attestor sets) that funds released + refunded never exceeds funds locked, for ANY valid configuration — this is the property that proves genuine generality, not just one hardcoded shape.

BUILD: `createCovenant(payer, payee, conditions[], releaseRule, amount, expiry)`, `postCondition(covenantId, conditionIndex, value)` (registered attestor for that condition only), `attemptRelease(covenantId)` (permissionless trigger, evaluates whether the release rule is currently satisfied — pays out only if so), `refundExpired(covenantId)`. Full test suite + the generality-proving fuzz test in invariant 5 across randomized configurations. Report test count, invariants covered, and confirm the fuzz test genuinely randomizes configuration shape, not just amounts.

---
## STAGE 2 — Three reference configurations

TypeScript services (services/) implementing three concrete setups against the SAME deployed contract, each in its own file:
- `config-escrow.ts` — a simple two-party escrow (one condition, one attestor, ALL rule).
- `config-parametric.ts` — a one-oracle parametric trigger (mirrors Parametrix's shape, one condition, ANY rule).
- `config-tranche.ts` — a multi-attestor tranche release (M-of-N rule, 2-of-3 attestors).
Tests for all three against one shared contract instance — the point is proving reuse, so the tests should explicitly assert the same contract address serves all three.

---
## STAGE 3 — Arc testnet deployment + lifecycle proof

Deploy Covenant ONCE to Arc testnet (RPC https://rpc.testnet.arc.network, chain 5042002). Verify USDC address onchain before use; read docs.arc.io/arc/references/evm-differences first. Deployer key from .env, never committed.

Run all three reference configurations as real transactions against that single deployed contract. Capture all explorer links into docs/addresses.md, organized by configuration, and explicitly note in the doc that all three share one contract address — that is the entire point of this project. Verify source on testnet.arcscan.app.

---
## STAGE 4 — Demo interface

Minimal CLI or single-page UI letting a viewer pick one of the three reference configurations, watch it run against the live contract, and see the real explorer link — with the SAME contract address displayed across all three, making the "one primitive, many shapes" claim visually obvious. Update README. Commit and report final state.
