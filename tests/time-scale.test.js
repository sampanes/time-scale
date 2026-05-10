import assert from "node:assert/strict";
import test from "node:test";

import {
  SCALE_MODES,
  createPercentMapper,
  formatDurationMa,
  formatMa,
  getItemDurationMa,
  getTimelineRange,
} from "../src/lib/time-scale.js";

test("formatMa formats past, present, recent, and future values", () => {
  assert.equal(formatMa(0), "Now");
  assert.equal(formatMa(13_800), "13.80 Ga ago");
  assert.equal(formatMa(0.012), "12 kya");
  assert.equal(formatMa(-5_000), "+5.0 Ga future");
});

test("formatDurationMa removes relative direction", () => {
  assert.equal(formatDurationMa(66), "66.00 Ma");
});

test("getTimelineRange pads mixed point and span items", () => {
  const range = getTimelineRange([
    { start_ma: 251.9, end_ma: 201.4 },
    { start_ma: 66, end_ma: 66 },
  ]);

  assert.equal(range.minMa, 66);
  assert.equal(range.maxMa, 251.9);
  assert.ok(range.viewMin < range.minMa);
  assert.ok(range.viewMax > range.maxMa);
});

test("getItemDurationMa returns span length in Ma", () => {
  assert.equal(getItemDurationMa({ start_ma: 251.9, end_ma: 201.4 }), 50.5);
});

test("createPercentMapper maps older dates toward the top/left edge", () => {
  const range = { viewMin: 0, viewMax: 100 };
  const linear = createPercentMapper(range, SCALE_MODES.LINEAR);

  assert.equal(linear(100), 0);
  assert.equal(linear(0), 100);
});
