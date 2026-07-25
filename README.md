# Covenant

**The universal conditional-release primitive. Built on Arc.**

A single configurable conditional-release engine. One covenant can express simple escrow, parametric triggers, multi-attestor tranche release, or tiered-outcome payment — through configuration alone, not new contracts. Per PRD §2, this is the meta-primitive that generalizes CareRail/TrustRail/TrueCarbon/Parametrix/Ladder.

Status: early build · Arc testnet · **unaudited — process-level enforcement, not attestation truth.**

Docs: [`docs/PRD.md`](docs/PRD.md) · Build prompts: [`PROMPT.md`](PROMPT.md) · Testnet addresses: [`docs/addresses.md`](docs/addresses.md)

## Quickstart

```bash
forge test               # invariant tests incl. generality fuzz
npm install && npm test  # off-chain unit tests
```

## Honesty rules

- v1 covenant enforces the *process* around attestations, not the truth of the attestation.
- Unaudited testnet software — do not use with real funds.
- The contract is immutable (no upgrade mechanism in v1 per PRD §4).
