// نتأكد إن المبالغ والهللات تنحسب بدقة.
import test from "node:test";
import assert from "node:assert/strict";
import { validMoney, toCents } from "../src/money.js";

test("money validation", () => {
  assert.equal(validMoney(10.25), true);
  assert.equal(validMoney(10.001), false);
  assert.equal(validMoney(0), false);
  assert.equal(validMoney("10.25"), false);
  assert.equal(toCents("0.29"), 29);
  assert.equal(toCents("0.10") + toCents("0.20"), 30);
});

// نقارن الهللات بدقة حتى مع المبالغ الكبيرة.
test("money preserves decimal cents without floating point rejection", () => {
  assert.equal(validMoney(10000000.03), true);
  assert.equal(validMoney(10000000000.03), true);
  assert.equal(toCents("10000000000.03"), 1000000000003);
  assert.equal(toCents("999999999999.99"), 99999999999999);
  assert.throws(() => toCents("10.001"));
  assert.throws(() => toCents("1e3"));
  assert.throws(() => toCents("1000000000000.00"));
});
