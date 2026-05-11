import assert from "node:assert/strict";
import test from "node:test";

import { buildVerticalTimelineViewModel, getVerticalTimelineRange } from "../src/lib/timeline-view-model.js";

test("getVerticalTimelineRange pads selected span by ratio", () => {
  const range = getVerticalTimelineRange([{ start_ma: 100, end_ma: 50 }], { rangePaddingRatio: 0.1 });

  assert.equal(range.minMa, 50);
  assert.equal(range.maxMa, 100);
  assert.equal(range.viewMin, 45);
  assert.equal(range.viewMax, 105);
});

test("getVerticalTimelineRange gives single point selections a minimum span", () => {
  const range = getVerticalTimelineRange([{ start_ma: 66, end_ma: 66 }], {
    rangePaddingRatio: 0,
    minSinglePointSpanMa: 2,
  });

  assert.equal(range.viewMin, 65);
  assert.equal(range.viewMax, 67);
});

test("buildVerticalTimelineViewModel maps segment events to vertical top and height", () => {
  const model = buildVerticalTimelineViewModel([{ id: "span", name: "Span", type: "period", start_ma: 100, end_ma: 50 }], {
    pxPerMa: 2,
    viewportHeight: 400,
    rangePaddingRatio: 0,
    typeColors: { period: ["#123456"] },
  });

  assert.equal(model.contentHeight, 100);
  assert.equal(model.segments[0].top, 0);
  assert.equal(model.segments[0].height, 100);
  assert.equal(model.segments[0].color, "#123456");
});

test("buildVerticalTimelineViewModel renders point events as lines", () => {
  const model = buildVerticalTimelineViewModel([{ id: "point", name: "Point", type: "event", start_ma: 10, end_ma: 10, color: "#abcdef" }], {
    pxPerMa: 10,
    viewportHeight: 200,
    rangePaddingRatio: 0,
    minSinglePointSpanMa: 2,
  });

  assert.equal(model.segments[0].isPoint, true);
  assert.equal(model.segments[0].height, 0);
  assert.equal(model.segments[0].y, 10);
  assert.equal(model.segments[0].color, "#abcdef");
});

test("buildVerticalTimelineViewModel survives the Big Bang -> Heat Death range without hanging", () => {
  const cosmicSelection = [
    { id: "big-bang", name: "Big Bang", type: "event", start_ma: 13800, end_ma: 13800 },
    { id: "first-life", name: "First Life", type: "event", start_ma: 3800, end_ma: 3800 },
    { id: "first-humans", name: "Homo Sapiens", type: "event", start_ma: 0.3, end_ma: 0.3 },
    { id: "now", name: "Now", type: "event", start_ma: 0, end_ma: 0 },
    { id: "sun-expands", name: "Sun Leaves Main Sequence", type: "future", start_ma: -5000, end_ma: -5000 },
    { id: "heat-death", name: "Heat Death", type: "future", start_ma: -1e32, end_ma: -1e32 },
  ];

  const start = Date.now();
  const model = buildVerticalTimelineViewModel(cosmicSelection, {
    pxPerMa: 7e-30,
    viewportHeight: 800,
    rangePaddingRatio: 0.08,
  });

  assert.ok(Date.now() - start < 500, "model build must terminate quickly");
  assert.equal(model.segments.length, cosmicSelection.length);
  assert.ok(model.ticks.length < 200, `tick set must stay small for huge spans, got ${model.ticks.length}`);
  model.segments.forEach((segment) => {
    assert.ok(Number.isFinite(segment.top) || Number.isFinite(segment.y), `segment ${segment.id} must have finite coords`);
  });
});

test("buildVerticalTimelineViewModel returns sorted visible ticks", () => {
  const model = buildVerticalTimelineViewModel([{ id: "span", name: "Span", type: "period", start_ma: 100, end_ma: 0 }], {
    pxPerMa: 10,
    viewportHeight: 400,
    rangePaddingRatio: 0,
  });

  assert.ok(model.ticks.length > 0);
  assert.deepEqual(
    model.ticks.map((tick) => tick.y),
    model.ticks.map((tick) => tick.y).toSorted((a, b) => a - b),
  );
});
