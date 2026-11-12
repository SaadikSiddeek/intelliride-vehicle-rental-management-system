import test from "node:test";
import assert from "node:assert/strict";
import { initialCalculator, calculatorReducer } from "./calculator-engine.mjs";
const run = (...keys) => keys.reduce(calculatorReducer, initialCalculator()).display;
test("arithmetic, chaining and repeated equals", () => { assert.equal(run("8", "÷", "2", "+", "3", "=", "="), "10"); assert.equal(run("9", "−", "4", "="), "5"); });
test("decimal precision and percentage semantics", () => { assert.equal(run(".", "1", "+", ".", "2", "="), "0.3"); assert.equal(run("2", "0", "0", "+", "1", "0", "%", "="), "220"); assert.equal(run("5", "0", "×", "1", "0", "%", "="), "5"); });
test("clear, backspace, sign and error recovery", () => { assert.equal(run("1", "2", "⌫", "±"), "-1"); assert.equal(run("8", "÷", "0", "="), "Error"); assert.equal(run("8", "÷", "0", "=", "4"), "4"); assert.equal(run("8", "AC"), "0"); });
