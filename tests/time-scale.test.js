import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDurationMa,
  formatMa,
  getItemDurationMa,
} from "../src/lib/time-scale.js";

test("formatMa formats past, present, recent, and future values", () => {
  assert.equal(formatMa(0), "Now");
  assert.equal(formatMa(13_800), "13.80 Ga ago");
  assert.equal(formatMa(0.012), "12 kya");
  assert.equal(formatMa(-5_000), "+5.0 Ga future");
  assert.equal(formatMa(-1e32), "+1.00e+32 Ma future");
});

test("formatDurationMa removes relative direction", () => {
  assert.equal(formatDurationMa(66), "66.00 Ma");
});

test("getItemDurationMa returns span length in Ma", () => {
  assert.equal(getItemDurationMa({ start_ma: 251.9, end_ma: 201.4 }), 50.5);
});
