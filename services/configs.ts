/**
 * Covenant — three reference configurations on the SAME deployed contract
 * -----------------------------------------------------------------------
 * Per PRD §2, the point of Covenant is that one audited core can express
 * simple escrow, parametric insurance, and multi-attestor tranche release
 * through configuration alone. This file implements all three against a
 * single Covenant address.
 *
 *   - configEscrow.ts:      simple two-party escrow, one attestor, ALL rule
 *   - configParametric.ts:  one-oracle parametric trigger, ANY rule
 *   - configTranche.ts:     multi-attestor tranche release, M-of-N (2-of-3)
 *
 * Each config has its own factory + run() function. The tests assert that
 * the same contract address serves all three.
 */
import { Contract, JsonRpcProvider, Wallet, parseUnits, formatUnits } from "ethers";

const ARC_RPC = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
const EXPLORER = process.env.EXPLORER_BASE ?? "https://testnet.arcscan.app";
const COV = process.env.COV_ADDRESS ?? "";
const USDC = process.env.USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";
const PAYER_PK = process.env.PAYER_KEY ?? "";
const ORACLE_PK = process.env.ORACLE_KEY ?? "";
const A1_PK = process.env.ATTESTOR1_KEY ?? "";
const A2_PK = process.env.ATTESTOR2_KEY ?? "";
const A3_PK = process.env.ATTESTOR3_KEY ?? "";

const COV_ABI = [
  "function createCovenant(address,address[],uint8,uint256,uint96,uint64) returns (uint256)",
  "function postCondition(uint256,uint256)",
  "function attemptRelease(uint256)",
  "function refundExpired(uint256)",
  "function getCovenant(uint256) view returns (tuple(address payer,address payee,uint96 amount,uint64 expiry,uint8 rule,uint256 threshold,tuple(address,bool)[] conditions,uint8 state))",
];
const ERC20 = ["function approve(address,uint256) returns (bool)"];

function link(kind: "tx" | "address", id: string) { return `${EXPLORER}/${kind}/${id}`; }

async function approve(signerPk: string, amount: bigint) {
  const provider = new JsonRpcProvider(ARC_RPC);
  const w = new Wallet(signerPk, provider);
  const usdc = new Contract(USDC, ERC20, w);
  const tx = await usdc.approve(COV, amount);
  await tx.wait();
  return tx.hash;
}

// ------------------------------------------------------------------
// 1. config-escrow: simple two-party escrow, one attestor, ALL rule
// ------------------------------------------------------------------

export async function configEscrow() {
  console.log("\n=== Config 1: simple two-party escrow (1 attestor, ALL) ===\n");
  const provider = new JsonRpcProvider(ARC_RPC);
  const payer = new Wallet(PAYER_PK, provider);
  const a1 = new Wallet(A1_PK, provider);
  const payee = await new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d").getAddress();

  const cov = new Contract(COV, COV_ABI, payer);
  const attestors = [await a1.getAddress()];

  await approve(PAYER_PK, parseUnits("100", 6));
  let tx = await cov.createCovenant(payee, attestors, 0, 1, parseUnits("100", 6), Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
  const r = await tx.wait();
  const id = Number(r!.logs[0].topics[1]);
  console.log(`  createCovenant  ${link("tx", tx.hash)}  block ${r!.blockNumber}  (id=${id})`);

  const covA1 = new Contract(COV, COV_ABI, a1);
  tx = await covA1.postCondition(id, 0);
  await tx.wait();
  console.log(`  postCondition   ${link("tx", tx.hash)}`);

  tx = await cov.attemptRelease(id);
  const r2 = await tx.wait();
  console.log(`  attemptRelease  ${link("tx", tx.hash)}  block ${r2!.blockNumber}`);
  return id;
}

// ------------------------------------------------------------------
// 2. config-parametric: one oracle, ANY rule
// ------------------------------------------------------------------

export async function configParametric() {
  console.log("\n=== Config 2: parametric insurance (1 oracle, ANY) ===\n");
  const provider = new JsonRpcProvider(ARC_RPC);
  const payer = new Wallet(PAYER_PK, provider);
  const oracle = new Wallet(ORACLE_PK, provider);
  const payee = await new Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a").getAddress();

  const cov = new Contract(COV, COV_ABI, payer);
  const attestors = [await oracle.getAddress()];

  await approve(PAYER_PK, parseUnits("500", 6));
  let tx = await cov.createCovenant(payee, attestors, 1, 1, parseUnits("500", 6), Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
  const r = await tx.wait();
  const id = Number(r!.logs[0].topics[1]);
  console.log(`  createCovenant  ${link("tx", tx.hash)}  block ${r!.blockNumber}  (id=${id})`);

  const covO = new Contract(COV, COV_ABI, oracle);
  tx = await covO.postCondition(id, 0);
  await tx.wait();
  console.log(`  postCondition   ${link("tx", tx.hash)}`);

  tx = await cov.attemptRelease(id);
  const r2 = await tx.wait();
  console.log(`  attemptRelease  ${link("tx", tx.hash)}  block ${r2!.blockNumber}`);
  return id;
}

// ------------------------------------------------------------------
// 3. config-tranche: 2-of-3 attestor tranche
// ------------------------------------------------------------------

export async function configTranche() {
  console.log("\n=== Config 3: multi-attestor tranche release (3 attestors, M-of-N = 2) ===\n");
  const provider = new JsonRpcProvider(ARC_RPC);
  const payer = new Wallet(PAYER_PK, provider);
  const a1 = new Wallet(A1_PK, provider);
  const a2 = new Wallet(A2_PK, provider);
  const a3 = new Wallet(A3_PK, provider);
  const payee = await new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d").getAddress();

  const cov = new Contract(COV, COV_ABI, payer);
  const attestors = [await a1.getAddress(), await a2.getAddress(), await a3.getAddress()];

  await approve(PAYER_PK, parseUnits("1000", 6));
  let tx = await cov.createCovenant(payee, attestors, 2, 2, parseUnits("1000", 6), Math.floor(Date.now() / 1000) + 30 * 24 * 3600);
  const r = await tx.wait();
  const id = Number(r!.logs[0].topics[1]);
  console.log(`  createCovenant  ${link("tx", tx.hash)}  block ${r!.blockNumber}  (id=${id})`);

  const covA1 = new Contract(COV, COV_ABI, a1);
  const covA2 = new Contract(COV, COV_ABI, a2);
  tx = await covA1.postCondition(id, 0);
  await tx.wait();
  tx = await covA2.postCondition(id, 1);
  await tx.wait();
  console.log(`  postCondition x2  (a1, a2) — threshold met`);

  tx = await cov.attemptRelease(id);
  const r2 = await tx.wait();
  console.log(`  attemptRelease  ${link("tx", tx.hash)}  block ${r2!.blockNumber}`);
  return id;
}
