import { configEscrow, configParametric, configTranche } from "./configs.ts";

async function main() {
  const which = process.argv[2] ?? "all";
  if (which === "1" || which === "all") await configEscrow();
  if (which === "2" || which === "all") await configParametric();
  if (which === "3" || which === "all") await configTranche();
  console.log(`\n  all three configurations ran against the SAME Covenant at ${COV}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });

const COV = process.env.COV_ADDRESS ?? "(unset)";
