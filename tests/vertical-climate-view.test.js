import assert from "node:assert/strict";
import test from "node:test";

import { buildVerticalClimateViewModel, renderVerticalClimateLane } from "../src/lib/vertical-climate-view.js";

test("focused CO2 track selects data resolution from the shared time range", () => {
  const model = buildVerticalClimateViewModel({ range: { viewMin: 0, viewMax: 450, minMa: 0, maxMa: 450 }, pxPerMa: 1, offsetY: 0, focusedMetricId: "co2" });
  assert.deepEqual(model.track.series.map((series) => series.id), ["proxy", "ice", "modern"]);
  assert.equal(model.track.max, 5000);
});

test("a focused metric gets one readable scale instead of normalized multi-track overlap", () => {
  const model = buildVerticalClimateViewModel({ range: { viewMin: 0, viewMax: 0.0002, minMa: 0, maxMa: 0.0002 }, pxPerMa: 2_000_000, offsetY: 20, focusedMetricId: "sea-level" });
  const html = renderVerticalClimateLane(model, 600);
  assert.equal(model.track.id, "sea-level");
  assert.match(html, /Sea-level rise/);
  assert.match(html, /0–25 cm since 1901/);
  assert.doesNotMatch(html, /GHG forcing/);
});

test("a magnified record appears when the literal modern record is too short to read", () => {
  const model = buildVerticalClimateViewModel({ range: { viewMin: 0, viewMax: 0.012, minMa: 0, maxMa: 0.012 }, pxPerMa: 40_000, offsetY: 20, focusedMetricId: "co2" });
  const html = renderVerticalClimateLane(model, 600);
  assert.ok(model.lens);
  assert.match(html, /Magnified record/);
  assert.match(html, /Not to timeline scale/);
});

test("the magnifier disappears once the literal record is readable", () => {
  const model = buildVerticalClimateViewModel({ range: { viewMin: 0, viewMax: 0.0002, minMa: 0, maxMa: 0.0002 }, pxPerMa: 2_000_000, offsetY: 20, focusedMetricId: "co2" });
  assert.equal(model.lens, null);
  assert.doesNotMatch(renderVerticalClimateLane(model, 600), /Magnified record/);
});
test("the literal area closes against the zero axis without a second move command", () => {
  const model = buildVerticalClimateViewModel({ range: { viewMin: 0, viewMax: 0.0002, minMa: 0, maxMa: 0.0002 }, pxPerMa: 2_000_000, offsetY: 20, focusedMetricId: "temperature" });
  const html = renderVerticalClimateLane(model, 600);
  assert.match(html, /vertical-climate-area" d="M 0 [^"]+ L /);
  assert.doesNotMatch(html, /vertical-climate-area" d="M 0 [^"]+ M /);
});

test("climate lane supports a fully decluttered state", () => {
  const model = buildVerticalClimateViewModel({ range: { viewMin: 0, viewMax: 1, minMa: 0, maxMa: 1 }, pxPerMa: 1, offsetY: 0, focusedMetricId: null });
  assert.match(renderVerticalClimateLane(model, 600), /Select a climate track/);
});
