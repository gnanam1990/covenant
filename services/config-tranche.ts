/**
 * Config 3 — multi-attestor tranche release (3 attestors, M-of-N = 2).
 * Runs against the shared Covenant.
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

export const RULE = Rule.M_OF_N;
export const THRESHOLD = 2;

/** The shared contract instance this config runs against. */
export function contractAddress() {
  return covAddress();
}

/** The payee for this config (from `PAYEE_ADDRESS` env). */
export function configPayee() {
  return payeeAddress();
}

export async function configTranche() {
  console.log("\n=== Config 3: multi-attestor tranche release (3 attestors, M-of-N = 2) ===\n");
  const PAYER_PK = process.env.PAYER_KEY ?? "";
  const A1_PK = process.env.ATTESTOR1_KEY ?? "";
  const A2_PK = process.env.ATTESTOR2_KEY ?? "";
  const A3_PK = process.env.ATTESTOR3_KEY ?? "";
  const provider = getProvider();
  const a1Addr = new Wallet(A1_PK, provider).address;
  const a2Addr = new Wallet(A2_PK, provider).address;
  const a3Addr = new Wallet(A3_PK, provider).address;

  const cov = getContract(PAYER_PK);
  const attestors = [a1Addr, a2Addr, a3Addr];

  await approve(PAYER_PK, parseUnits("1000", 6));
  let tx = await cov.createCovenant(
    payeeAddress(),
    attestors,
    RULE,
    THRESHOLD,
    parseUnits("1000", 6),
    Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  );
  const r = await tx.wait();
  const id = parseCovenantId(r!);
  console.log(`  createCovenant  ${link("tx", tx.hash)}  block ${r!.blockNumber}  (id=${id})`);

  const covA1 = getContract(A1_PK);
  const covA2 = getContract(A2_PK);
  tx = await covA1.postCondition(id, 0, true);
  await tx.wait();
  tx = await covA2.postCondition(id, 1, true);
  await tx.wait();
  console.log(`  postCondition x2  (a1, a2) — threshold met`);

  tx = await cov.attemptRelease(id);
  const r2 = await tx.wait();
  console.log(`  attemptRelease  ${link("tx", tx.hash)}  block ${r2!.blockNumber}`);
  return id;
}
