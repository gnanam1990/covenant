/**
 * Covenant — shared wiring for the three reference configurations.
 * ----------------------------------------------------------------
 * Single source of truth for RPC, addresses, ABI, and receipt parsing.
 * `config-escrow.ts`, `config-parametric.ts`, and `config-tranche.ts` all
 * import from here, so they provably share ONE deployed contract instance
 * (resolved from `COV_ADDRESS`) and ONE payee source (`PAYEE_ADDRESS`).
 *
 * Fixes applied here (Phase-2):
 * - Covenant id parsing finds the `CovenantCreated` log by event signature
 *   instead of blindly reading `logs[0]` (which may be the USDC approval).
 * - Payees come from `PAYEE_ADDRESS` env — no hardcoded private keys.
 * - `postCondition` ABI carries the `bool value` outcome vote per spec.
 */
import { Contract, Interface, JsonRpcProvider, Wallet } from "ethers";
import type { TransactionReceipt } from "ethers";

export const ARC_RPC = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
export const EXPLORER = process.env.EXPLORER_BASE ?? "https://testnet.arcscan.app";
export const USDC_ADDRESS =
  process.env.USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";

/** Release-rule encoding (must match Covenant.ReleaseRule). */
export const Rule = { ALL: 0, ANY: 1, M_OF_N: 2 } as const;

/** The single deployed Covenant serving all three configs. Read dynamically so tests can override env. */
export function covAddress(): string {
  const a = process.env.COV_ADDRESS ?? "";
  if (!a) throw new Error("COV_ADDRESS env is not set");
  return a;
}

/** Release/refund counterparty. One env var — never a hardcoded key. */
export function payeeAddress(): string {
  const a = process.env.PAYEE_ADDRESS ?? "";
  if (!a) throw new Error("PAYEE_ADDRESS env is not set (payees must come from env, not hardcoded keys)");
  return a;
}

export const COV_ABI = [
  "event CovenantCreated(uint256 indexed id, address indexed payer, address indexed payee, uint96 amount, uint8 rule, uint256 threshold, uint64 expiry)",
  "event ConditionPosted(uint256 indexed id, uint256 indexed conditionIndex, address indexed attestor)",
  "function createCovenant(address,address[],uint8,uint256,uint96,uint64) returns (uint256)",
  "function postCondition(uint256,uint256,bool)",
  "function attemptRelease(uint256)",
  "function refundExpired(uint256)",
  "function getCovenant(uint256) view returns (tuple(address payer,address payee,uint96 amount,uint64 expiry,uint8 rule,uint256 threshold,tuple(address attestor,bool confirmed,bool outcome)[] conditions,uint8 state))",
];
export const ERC20_ABI = ["function approve(address,uint256) returns (bool)"];

export const COV_INTERFACE = new Interface(COV_ABI);

export function link(kind: "tx" | "address", id: string) {
  return `${EXPLORER}/${kind}/${id}`;
}

export function getProvider() {
  return new JsonRpcProvider(ARC_RPC);
}

export function getContract(signerPk: string) {
  return new Contract(covAddress(), COV_ABI, new Wallet(signerPk, getProvider()));
}

export async function approve(signerPk: string, amount: bigint) {
  const w = new Wallet(signerPk, getProvider());
  const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, w);
  const tx = await usdc.approve(covAddress(), amount);
  await tx.wait();
  return tx.hash as string;
}

/**
 * Find the covenant id from a createCovenant receipt by locating the
 * `CovenantCreated` log — NOT `logs[0]` (which is typically the USDC
 * `Approval` event from the preceding `approve` in the same flow, or any
 * other log the RPC happens to order first).
 */
export function parseCovenantId(receipt: TransactionReceipt): number {
  for (const log of receipt.logs) {
    let parsed;
    try {
      parsed = COV_INTERFACE.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue; // not a Covenant log (e.g. ERC20 Approval/Transfer)
    }
    if (parsed?.name === "CovenantCreated") return Number(parsed.args.id);
  }
  throw new Error("CovenantCreated log not found in receipt");
}
