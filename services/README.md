# Covenant reference configurations

Per PRD §2, Covenant's point is that one audited core can express different verticals through configuration alone. Three thin wrappers over `shared.ts` implement the reference configurations against a single deployed `Covenant` address:

| File | Vertical | Rule | Attestors | Threshold |
|------|----------|------|-----------|-----------|
| `config-escrow.ts` (`configEscrow`) | two-party escrow | ALL | 1 | 1 |
| `config-parametric.ts` (`configParametric`) | parametric insurance | ANY | 1 oracle | 1 |
| `config-tranche.ts` (`configTranche`) | multi-attestor tranche | M_OF_N | 3 | 2-of-3 |

`shared.ts` is the single source of truth: `COV_ADDRESS` (the one contract), `PAYEE_ADDRESS` (payee for all three — never a hardcoded key), the ABI (incl. `postCondition(uint256,uint256,bool)`), and `parseCovenantId()` which locates the `CovenantCreated` log by event signature instead of trusting `logs[0]`. `configs.ts` is a deprecated re-export shim.

## Tests

`services/test/configs.test.ts` (5 tests, no network) verifies that the same `COV_ADDRESS` is shared by all three (one primitive, many shapes), that the rule encodings are distinct, that payees resolve from `PAYEE_ADDRESS`, and that receipt parsing finds `CovenantCreated` even when `logs[0]` is a stray ERC20 log.

## Honesty rules

- Same deployed contract, three different configuration shapes. The point of the test is the *sameness of the address*, not the sameness of the data.
- Attestors are mocks for demo purposes; replace with real verification partners in production.
