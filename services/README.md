# Covenant reference configurations

Per PRD §2, Covenant's point is that one audited core can express different verticals through configuration alone. This package implements three reference configurations on the same deployed `Covenant` address:

| File | Vertical | Rule | Attestors | Threshold |
|------|----------|------|-----------|-----------|
| `configEscrow` | two-party escrow | ALL | 1 | 1 |
| `configParametric` | parametric insurance | ANY | 1 oracle | 1 |
| `configTranche` | multi-attestor tranche | M_OF_N | 3 | 2-of-3 |

## Tests

`configs.test.ts` verifies that the same `COV_ADDRESS` is shared by all three (one primitive, many shapes) and that the rule encoding is distinct.

## Honesty rules

- Same deployed contract, three different configuration shapes. The point of the test is the *sameness of the address*, not the sameness of the data.
- Attestors are mocks for demo purposes; replace with real verification partners in production.
