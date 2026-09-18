import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTimestamp } from "./time.js";

test("normalizes legacy Taipei timestamps to UTC ISO strings", () => {
  assert.equal(normalizeTimestamp("2026/9/18 08:30:45"), "2026-09-18T00:30:45.000Z");
});

test("keeps absolute ISO timestamps at the same instant", () => {
  assert.equal(normalizeTimestamp("2026-09-18T00:30:45.000Z"), "2026-09-18T00:30:45.000Z");
});

test("preserves null timestamp values", () => {
  assert.equal(normalizeTimestamp(null), null);
});
