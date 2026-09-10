/**
 * Tests for the three reference configurations — no network required.
 *
 * The point of Covenant is reuse: all three configs must resolve to the SAME
 * deployed contract instance (`COV_ADDRESS` via `./shared.ts`), with distinct
 * rule encodings and an env-driven payee (no hardcoded keys).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Deterministic env for the suite (helpers read env dynamically at call time).
process.env.COV_ADDRESS = "0x1111111111111111111111111111111111111111";
process.env.PAYEE_ADDRESS = "0x2222222222222222222222222222222222222222";

const { contractAddress: escrowAddr, RULE: escrowRule, configPayee: escrowPayee } =
  await import("../config-escrow.ts");
const { contractAddress: parametricAddr, RULE: parametricRule, configPayee: parametricPayee } =
  await import("../config-parametric.ts");
const { contractAddress: trancheAddr, RULE: trancheRule, configPayee: tranchePayee } =
  await import("../config-tranche.ts");
const { COV_INTERFACE, covAddress, parseCovenantId, payeeAddress } =
  await import("../shared.ts");

describe("Reference configurations share one contract instance", () => {
  it("same COV_ADDRESS serves all three (one primitive, many shapes)", () => {
    assert.equal(escrowAddr(), process.env.COV_ADDRESS);
    assert.equal(parametricAddr(), process.env.COV_ADDRESS);
    assert.equal(trancheAddr(), process.env.COV_ADDRESS);
    assert.equal(escrowAddr(), parametricAddr());
    assert.equal(parametricAddr(), trancheAddr());
    assert.equal(covAddress(), escrowAddr());
  });

  it("encodes three distinct rules (ALL=0, ANY=1, M_OF_N=2)", () => {
    assert.equal(escrowRule, 0);
    assert.equal(parametricRule, 1);
    assert.equal(trancheRule, 2);
    assert.notEqual(escrowRule, parametricRule);
    assert.notEqual(parametricRule, trancheRule);
    assert.notEqual(escrowRule, trancheRule);
  });

  it("payees come from PAYEE_ADDRESS env, not hardcoded keys", () => {
    assert.equal(escrowPayee(), process.env.PAYEE_ADDRESS);
    assert.equal(parametricPayee(), process.env.PAYEE_ADDRESS);
    assert.equal(tranchePayee(), process.env.PAYEE_ADDRESS);
    // Env-driven: changing the var changes the resolution (no frozen constant).
    process.env.PAYEE_ADDRESS = "0x3333333333333333333333333333333333333333";
    assert.equal(payeeAddress(), "0x3333333333333333333333333333333333333333");
    assert.equal(tranchePayee(), "0x3333333333333333333333333333333333333333");
    process.env.PAYEE_ADDRESS = "0x2222222222222222222222222222222222222222";
  });

  it("parseCovenantId finds CovenantCreated, not logs[0]", () => {
    // logs[0] is a stray ERC20 Approval (the old code read this and broke);
    // the real CovenantCreated event sits at logs[1].
    const approval = {
      topics: [
        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
        "0x0000000000000000000000001111111111111111111111111111111111111111",
        "0x0000000000000000000000002222222222222222222222222222222222222222",
      ],
      data: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    };
    const created = COV_INTERFACE.encodeEventLog("CovenantCreated", [
      42, "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222", 100_000_000, 2, 2, 9999999999,
    ]);
    const receipt = { logs: [approval, created] } as never;
    assert.equal(parseCovenantId(receipt), 42);
  });

  it("parseCovenantId throws when no CovenantCreated log exists", () => {
    assert.throws(() => parseCovenantId({ logs: [] } as never), /CovenantCreated/);
  });
});
