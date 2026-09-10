/**
 * Config 2 — one-oracle parametric trigger (mirrors Parametrix's shape,
 * 1 oracle attestor, ANY rule). Runs against the shared Covenant.
 */
import { Wallet, parseUnits } from "ethers";
import {
  Rule,
  approve,
  covAddress,
  getContract,
  getProvider,
  link,
  parseCovenantId,
  payeeAddress,
} from "./shared.ts";

export const RULE = Rule.ANY;
export const THRESHOLD = 1;

/** The shared contract instance this config runs against. */
export function contractAddress() {
  return covAddress();
}

/** The payee for this config (from `PAYEE_ADDRESS` env). */
export function configPayee() {
  return payeeAddress();
}

export async function configParametric() {
  console.log("\n=== Config 2: parametric insurance (1 oracle, ANY) ===\n");
  const PAYER_PK = process.env.PAYER_KEY ?? "";
  const ORACLE_PK = process.env.ORACLE_KEY ?? "";
  const oracleAddr = new Wallet(ORACLE_PK, getProvider()).address;

  const cov = getContract(PAYER_PK);
  const attestors = [oracleAddr];

  await approve(PAYER_PK, parseUnits("500", 6));
  let tx = await cov.createCovenant(
    payeeAddress(),
    attestors,
    RULE,
    THRESHOLD,
    parseUnits("500", 6),
    Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
  );
  const r = await tx.wait();
  const id = parseCovenantId(r!);
  console.log(`  oracle=${oracleAddr}`);
  console.log(`  createCovenant  ${link("tx", tx.hash)}  block ${r!.blockNumber}  (id=${id})`);

  const covO = getContract(ORACLE_PK);
  tx = await covO.postCondition(id, 0, true);
  await tx.wait();
  console.log(`  postCondition   ${link("tx", tx.hash)}`);

  tx = await cov.attemptRelease(id);
  const r2 = await tx.wait();
  console.log(`  attemptRelease  ${link("tx", tx.hash)}  block ${r2!.blockNumber}`);
  return id;
}
