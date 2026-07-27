import assert from "node:assert/strict";
import test from "node:test";

import { buildVerticalClimateViewModel, renderVerticalClimateLane } from "../src/lib/vertical-climate-view.js";

test("vertical CO2 track selects data resolution from the shared time range", () => {
  const model = buildVerticalClimateViewModel({
    range: { viewMin: 0, viewMax: 450, minMa: 0, maxMa: 450 },
    pxPerMa: 1,
    offsetY: 0,
  });
  const co2 = model.tracks[0];
  assert.deepEqual(co2.series.map((series) => series.id), ["proxy", "ice", "modern"]);
  assert.equal(co2.max, 5000);
});

test("modern vertical climate lane expands selected metrics on the shared vertical axis", () => {
  const model = buildVerticalClimateViewModel({
    range: { viewMin: 0, viewMax: 0.0002, minMa: 0, maxMa: 0.0002 },
    pxPerMa: 2_000_000,
    offsetY: 20,
    activeMetricIds: ["co2", "forcing", "sea-level"],
  });
  const html = renderVerticalClimateLane(model, 600);
  assert.deepEqual(model.tracks.map((track) => track.id), ["co2", "forcing", "sea-level"]);
  assert.match(html, /3 climate signals/);
  assert.match(html, /GHG forcing/);
  assert.match(html, /Sea level/);
  assert.match(html, /vertical-climate-line/);
});

test("climate lane supports a fully decluttered state", () => {
  const model = buildVerticalClimateViewModel({
    range: { viewMin: 0, viewMax: 1, minMa: 0, maxMa: 1 },
    pxPerMa: 1,
    offsetY: 0,
    activeMetricIds: [],
  });
  assert.match(renderVerticalClimateLane(model, 600), /Select a climate metric/);
});
