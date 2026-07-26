import assert from "node:assert/strict";
import test from "node:test";

import { CLIMATE_VIEWS } from "../src/data/climate-data.js";
import { getClimateView, renderClimateChart, renderClimateExperience } from "../src/lib/climate-view.js";

const allLayers = {
  context: true,
  callouts: true,
  uncertainty: true,
  indicators: true,
  sources: true,
};

test("climate views cover modern, ice-core, and deep-time scales", () => {
  assert.deepEqual(CLIMATE_VIEWS.map((view) => view.id), ["industrial", "ice-ages", "deep-time"]);
  assert.equal(getClimateView("missing").id, "industrial");
  assert.ok(getClimateView("ice-ages").co2.length > 10);
});

test("deep-time chart renders proxy uncertainty and contextual bands", () => {
  const html = renderClimateChart(getClimateView("deep-time"), allLayers);
  assert.match(html, /climate-uncertainty/);
  assert.match(html, /Trilobites/);
  assert.match(html, /Triassic: 2,000–5,000 ppm/);
});

test("climate layers can independently declutter the experience", () => {
  const html = renderClimateExperience({
    viewId: "industrial",
    layers: {
      context: false,
      callouts: false,
      uncertainty: false,
      indicators: false,
      sources: false,
    },
  });

  assert.doesNotMatch(html, /climate-indicators/);
  assert.doesNotMatch(html, /climate-sources/);
  assert.match(html, /data-climate-layer="context"/);
});
