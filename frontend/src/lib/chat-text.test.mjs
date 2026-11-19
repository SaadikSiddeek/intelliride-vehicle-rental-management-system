import assert from "node:assert/strict";
import test from "node:test";
import { readableChatText } from "./chat-text.mjs";

test("provider HTML and Markdown become readable paragraphs without executing markup", () => {
  const text = readableChatText('### Return steps\n\n**Inspect** the car.<br>Check fuel &amp; mileage.\n- Record `odometer`.');
  assert.equal(text, 'Return steps\n\nInspect the car.\nCheck fuel & mileage.\n• Record odometer.');
  assert.equal(readableChatText('<script>alert(1)</script><p>Hello</p><img src=x onerror=alert(1)>'), 'Hello');
});

test("the observed workflow table becomes readable step sections", () => {
  const text = readableChatText('| Step | What happens | Staff action |\n|---|---|---|\n| **1. Booking** | Confirm.<br>Reserve. | Review. |\n| **2. Return** | Inspect. | Finalize. |');
  assert.match(text, /1\. Booking\n\nWhat happens\nConfirm\.\nReserve\./);
  assert.match(text, /2\. Return/);
  assert.ok(!/[|<>]/.test(text));
  assert.equal(readableChatText(null), '');
});
