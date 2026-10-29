import assert from "node:assert/strict";
import test from "node:test";

import { buildVerticalTimelineViewModel, getClusterSpreadPxPerMa, getVerticalTimelineRange } from "../src/lib/timeline-view-model.js";

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

test("buildVerticalTimelineViewModel increases segment mix as overlaps rise", () => {
  const model = buildVerticalTimelineViewModel(
    [
      { id: "wide", name: "Wide", type: "event", start_ma: 10, end_ma: 0 },
      { id: "middle", name: "Middle", type: "event", start_ma: 8, end_ma: 2 },
      { id: "narrow", name: "Narrow", type: "event", start_ma: 7, end_ma: 6 },
      { id: "separate", name: "Separate", type: "event", start_ma: -1, end_ma: -2 },
    ],
    {
      pxPerMa: 10,
      viewportHeight: 400,
      rangePaddingRatio: 0,
      typeColors: { event: ["#123456"] },
    },
  );

  const byId = Object.fromEntries(model.segments.map((segment) => [segment.id, segment]));

  assert.equal(byId.wide.overlapCount, 3);
  assert.equal(byId.middle.overlapCount, 3);
  assert.equal(byId.narrow.overlapCount, 3);
  assert.equal(byId.separate.overlapCount, 1);
  assert.ok(byId.wide.fillMixPct > byId.separate.fillMixPct);
  assert.ok(byId.wide.edgeMixPct > byId.separate.edgeMixPct);
  assert.ok(byId.wide.glowMixPct > byId.separate.glowMixPct);
});

test("buildVerticalTimelineViewModel survives the Big Bang -> Heat Death range without hanging", () => {
  const cosmicSelection = [
    { id: "big-bang", name: "Big Bang", type: "event", start_ma: 13800, end_ma: 13800 },
    { id: "first-life", name: "First Life", type: "event", start_ma: 3800, end_ma: 3800 },
    { id: "first-humans", name: "Homo Sapiens", type: "event", start_ma: 0.3, end_ma: 0.3 },
    { id: "now", name: "Now", type: "event", start_ma: 0, end_ma: 0 },
    { id: "sun-expands", name: "Sun Leaves Main Sequence", type: "future", start_ma: -5000, end_ma: -5000 },
    { id: "heat-death", name: "Heat Death", type: "future", start_ma: -1e103, end_ma: -1e104 },
  ];

  const start = Date.now();
  const model = buildVerticalTimelineViewModel(cosmicSelection, {
    pxPerMa: 7e-102,
    viewportHeight: 800,
    rangePaddingRatio: 0.08,
  });

  assert.ok(Date.now() - start < 500, "model build must terminate quickly");
  assert.equal(model.segments.length, cosmicSelection.length - 1, "now item is represented by nowY, not a segment");
  assert.equal(model.nowActive, true);
  assert.ok(model.nowY !== null);
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

function instant(id, ma) {
  return { id, name: id.toUpperCase(), type: "event", start_ma: ma, end_ma: ma };
}

function buildInstants(mas, options = {}) {
  return buildVerticalTimelineViewModel(
    mas.map((ma, index) => instant(`p${index}`, ma)),
    { pxPerMa: 10, viewportHeight: 800, rangePaddingRatio: 0, ...options },
  );
}

test("instants whose labels would overprint stack under the oldest one", () => {
  const model = buildInstants([100, 99, 98, 50], { pointLabelStackPx: 26 });
  const byId = Object.fromEntries(model.segments.map((segment) => [segment.id, segment]));

  assert.equal(byId.p0.labelVisible, true, "the oldest instant keeps its label");
  assert.deepEqual(byId.p0.cluster.ids, ["p0", "p1", "p2"]);
  assert.deepEqual(byId.p0.cluster.names, ["P0", "P1", "P2"]);
  assert.deepEqual(byId.p0.cluster.mas, [100, 99, 98]);
  assert.equal(byId.p0.cluster.minMa, 98);
  assert.equal(byId.p0.cluster.maxMa, 100);
  for (const id of ["p1", "p2"]) {
    assert.equal(byId[id].labelVisible, false, `${id} draws only its line`);
    assert.equal(byId[id].clusterLeaderId, "p0");
    assert.equal(byId[id].cluster, null);
  }
  assert.equal(byId.p3.labelVisible, true, "a far instant keeps its own label");
  assert.equal(byId.p3.cluster, null, "a lone instant is not a stack");
  assert.equal(byId.p3.clusterLeaderId, null);
});

test("a stack is measured from its leader, so evenly spaced instants form several small stacks", () => {
  // 20 px apart each: 100 and 98 stack, 96 is 40 px below the leader and starts a new one.
  const model = buildInstants([100, 98, 96, 94], { pointLabelStackPx: 26 });
  const leaders = model.segments.filter((segment) => segment.labelVisible).map((segment) => segment.id);

  assert.deepEqual(leaders, ["p0", "p2"]);
  assert.deepEqual(model.segments[0].cluster.ids, ["p0", "p1"]);
  assert.deepEqual(model.segments[2].cluster.ids, ["p2", "p3"]);
});

test("instants arrive in selection order and still stack by position", () => {
  const model = buildInstants([98, 100, 99], { pointLabelStackPx: 26 });
  const leader = model.segments.find((segment) => segment.labelVisible);

  assert.equal(leader.id, "p1", "the topmost (oldest) instant leads regardless of selection order");
  assert.deepEqual(leader.cluster.ids, ["p1", "p2", "p0"]);
});

test("a zero stack height keeps every label and spans never stack", () => {
  const model = buildVerticalTimelineViewModel(
    [instant("a", 100), instant("b", 99.9), { id: "span", name: "Span", type: "era", start_ma: 100, end_ma: 99 }],
    { pxPerMa: 10, viewportHeight: 800, rangePaddingRatio: 0, pointLabelStackPx: 0 },
  );

  assert.ok(model.segments.filter((segment) => segment.isPoint).every((segment) => segment.labelVisible && segment.cluster === null));
  assert.equal(model.segments.find((segment) => segment.id === "span").cluster, undefined, "spans are left alone");
});

test("getClusterSpreadPxPerMa zooms just far enough for the closest neighbors to clear the label", () => {
  const cluster = { ids: ["a", "b", "c"], names: ["A", "B", "C"], mas: [100, 99.5, 96], minMa: 96, maxMa: 100 };
  const target = getClusterSpreadPxPerMa(cluster, { pxPerMa: 1, viewportHeight: 800, labelStackPx: 26 });

  // Closest gap is 0.5 Ma; it needs 26 * 1.4 px, so 72.8 px/Ma.
  assert.ok(Math.abs(target - 72.8) < 1e-9, `got ${target}`);
});

test("getClusterSpreadPxPerMa never leaps past most of the viewport or the zoom ceiling, and always steps in", () => {
  const wide = { ids: ["a", "b"], names: ["A", "B"], mas: [100, 99], minMa: 99, maxMa: 100 };

  // Tiny viewport: the 60% fit (30 px over 1 Ma) caps the 36.4 px/Ma spread.
  assert.equal(getClusterSpreadPxPerMa(wide, { pxPerMa: 1, viewportHeight: 50, labelStackPx: 26 }), 30);
  // Already closer than the spread would ask: still zoom in by the minimum factor.
  assert.equal(getClusterSpreadPxPerMa(wide, { pxPerMa: 100, viewportHeight: 800, labelStackPx: 26 }), 150);
  // The ceiling caps everything.
  assert.equal(getClusterSpreadPxPerMa(wide, { pxPerMa: 1, viewportHeight: 800, labelStackPx: 26, maxPxPerMa: 20 }), 20);
});

test("getClusterSpreadPxPerMa gives null for a stack that shares one moment", () => {
  const same = { ids: ["a", "b"], names: ["A", "B"], mas: [100, 100], minMa: 100, maxMa: 100 };

  assert.equal(getClusterSpreadPxPerMa(same, { pxPerMa: 1, viewportHeight: 800 }), null);
});
