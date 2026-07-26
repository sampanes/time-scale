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

test("timeline entries overlay at their true dates and report out-of-range selections", () => {
  const jesus = { id: "person-jesus", name: "Jesus of Nazareth", start_ma: 0.00203, end_ma: 0.001996, type: "person" };
  const hominins = { id: "first-hominins", name: "First Hominins", start_ma: 7, end_ma: 7, type: "event" };
  const state = { viewId: "ice-ages", layers: allLayers, contextItems: [jesus, hominins] };
  const html = renderClimateExperience(state);

  assert.match(html, /Jesus of Nazareth · 4 BCE/);
  assert.match(html, /1 of 2 selected items visible/);
  assert.match(html, /data-remove-climate-event="first-hominins" class="outside-range"/);
});
