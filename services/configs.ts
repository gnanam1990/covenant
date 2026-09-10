/**
 * @deprecated Phase-2 split: the three reference configurations now live in
 * `./config-escrow.ts`, `./config-parametric.ts`, and `./config-tranche.ts`
 * (thin wrappers over `./shared.ts`). This module only re-exports them so
 * existing imports keep working.
 */
export { configEscrow } from "./config-escrow.ts";
export { configParametric } from "./config-parametric.ts";
export { configTranche } from "./config-tranche.ts";
