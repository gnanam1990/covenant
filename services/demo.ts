import { configEscrow } from "./config-escrow.ts";
import { configParametric } from "./config-parametric.ts";
import { configTranche } from "./config-tranche.ts";

const COV = process.env.COV_ADDRESS ?? "(unset)";

async function main() {
  const which = process.argv[2] ?? "all";
  if (which === "1" || which === "all") await configEscrow();
  if (which === "2" || which === "all") await configParametric();
  if (which === "3" || which === "all") await configTranche();
  console.log(`\n  all three configurations ran against the SAME Covenant at ${COV}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
