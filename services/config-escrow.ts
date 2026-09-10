/**
 * Config 1 — simple two-party escrow (1 attestor, ALL rule).
 * Runs against the shared Covenant from `./shared.ts`.
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

export const RULE = Rule.ALL;
export const THRESHOLD = 1;

/** The shared contract instance this config runs against. */
export function contractAddress() {
  return covAddress();
}

/** The payee for this config (from `PAYEE_ADDRESS` env). */
export function configPayee() {
  return payeeAddress();
}

export async function configEscrow() {
  console.log("\n=== Config 1: simple two-party escrow (1 attestor, ALL) ===\n");
  const PAYER_PK = process.env.PAYER_KEY ?? "";
  const A1_PK = process.env.ATTESTOR1_KEY ?? "";
  const payerAddr = new Wallet(PAYER_PK, getProvider()).address;
  const a1Addr = new Wallet(A1_PK, getProvider()).address;

  const cov = getContract(PAYER_PK);
  const attestors = [a1Addr];

  await approve(PAYER_PK, parseUnits("100", 6));
  let tx = await cov.createCovenant(
    payeeAddress(),
    attestors,
    RULE,
    THRESHOLD,
    parseUnits("100", 6),
    Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  );
  const r = await tx.wait();
  const id = parseCovenantId(r!);
  console.log(`  payer=${payerAddr} attestors=${attestors.join(",")}`);
  console.log(`  createCovenant  ${link("tx", tx.hash)}  block ${r!.blockNumber}  (id=${id})`);

  const covA1 = getContract(A1_PK);
  tx = await covA1.postCondition(id, 0, true);
  await tx.wait();
  console.log(`  postCondition   ${link("tx", tx.hash)}`);

  tx = await cov.attemptRelease(id);
  const r2 = await tx.wait();
  console.log(`  attemptRelease  ${link("tx", tx.hash)}  block ${r2!.blockNumber}`);
  return id;
}
