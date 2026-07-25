# Covenant — PRD v1.0

**The universal conditional-release primitive. Built on Arc.**

## 1. Problem
Every project in this batch (CareRail, TrustRail, TrueCarbon, Parametrix, Ladder) independently reinvents the same underlying shape: funds lock, a registered party attests to a condition, funds release or refund. Rebuilding and re-auditing this pattern per vertical wastes effort and fragments trust — an ecosystem is better served by one deeply-tested primitive than five shallow, slightly-different ones.

## 2. Solution (MVP scope)
**Covenant (contract), a single configurable conditional-release engine.** A covenant is created with: a payer, a payee, a list of one or more **conditions** (each condition = an attestor address + a threshold/comparator + a value type), a release rule (ALL conditions must clear / ANY condition clears / M-of-N conditions clear), an amount (or tiered amounts per condition-combination), and an expiry. This single contract, correctly generalized, can express: a simple escrow (one condition, one attestor), a parametric-insurance trigger (one oracle condition), a multi-attestor aid tranche (M-of-N), and a tiered-outcome payment (Ladder-style) — without deploying a different contract for each.

**Reference configurations (proving generality, not exhaustiveness):** implement three concrete instantiations on top of the SAME deployed contract — a simple-proof escrow, an oracle-triggered parametric policy, and a multi-attestor tranche release — showing one audited core serving three different verticals' needs through configuration alone.

## 3. Why Arc specifically
A single, deeply-fuzzed, Arc-native primitive is more auditable and more trustworthy than many shallow reimplementations — Arc Explorer becomes a single canonical place to verify ANY conditional release across the ecosystem, and USDC-native settlement keeps the economics viable even for very small covenants.

## 4. Non-goals (v1)
No governance/upgrade mechanism for the core contract in v1 (immutable, matching the "don't reopen frozen contracts" discipline established elsewhere in this batch) · no UI beyond the three reference configurations · no token.

## 5. Demo moment
Deploy Covenant once. Configure and run, on the SAME deployed contract: (1) a simple two-party escrow release, (2) a one-oracle parametric trigger, (3) a two-of-three attestor tranche release — three genuinely different real-world shapes, one audited contract, three sets of real transactions, all visible on the same contract's Arc Explorer page.

## 6. Honesty rules
Real transactions only for all three configurations · unaudited testnet label · never claim the contract enforces the *truth* of an attestation, only the *process* around it — attestors' honesty is out of scope for the contract itself.
