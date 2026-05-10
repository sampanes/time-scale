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
