import assert from "node:assert/strict";
import test from "node:test";

import { buildVerticalClimateViewModel, renderVerticalClimateLane } from "../src/lib/vertical-climate-view.js";

test("vertical climate lane selects data resolution from the shared time range", () => {
  const model = buildVerticalClimateViewModel({
    range: { viewMin: 0, viewMax: 450, minMa: 0, maxMa: 450 },
    pxPerMa: 1,
    offsetY: 0,
  });

  assert.deepEqual(model.series.map((series) => series.id), ["proxy", "ice", "modern"]);
  assert.equal(model.ppmMax, 5000);
});

test("modern vertical climate lane expands CO2 horizontally while time remains vertical", () => {
  const model = buildVerticalClimateViewModel({
    range: { viewMin: 0, viewMax: 0.0002, minMa: 0, maxMa: 0.0002 },
    pxPerMa: 2_000_000,
    offsetY: 20,
  });
  const html = renderVerticalClimateLane(model, 600);

  assert.equal(model.ppmMax, 500);
  assert.ok(model.series.some((series) => series.id === "modern"));
  assert.match(html, /Atmospheric CO₂/);
  assert.match(html, /vertical-climate-line/);
});
