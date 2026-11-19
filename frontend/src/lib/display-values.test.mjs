import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, formatNumber } from "./display-values.mjs";

test("display formatters distinguish missing data, invalid data and a real zero", () => {
  for (const missing of [null, undefined, "", " "]) assert.equal(formatMoney(missing), "—");
  for (const invalid of [NaN, Infinity, "Nimal Perera", false, {}]) assert.equal(formatNumber(invalid), "Unavailable");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber("1234.125"), "1,234.125");
  assert.match(formatMoney("1234.50"), /1,234\.50$/);
});
