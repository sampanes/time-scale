import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_TICK_SPACING_PX,
  applyRubberDelta,
  clampOffset,
  createTickPlan,
  formatCalendarYear,
  getContentHeight,
  getOffsetBounds,
  makeVisibleTicks,
  maToY,
  niceInterval,
  yToMa,
  zoomAroundY,
} from "../src/lib/vertical-scale.js";

const SWEEP_PX_PER_MA = [1e-3, 1e-2, 0.1, 1, 10, 35, 100, 300, 1000, 5000, 2e4, 1e5, 1e6, 2e6];
const SWEEP_RANGES = [
  { viewMin: 0, viewMax: 4000 },
  { viewMin: 0, viewMax: 0.02 },
];

function sweepOffsets(range, pxPerMa, viewportHeight) {
  const bounds = getOffsetBounds(getContentHeight(range, pxPerMa), viewportHeight);
  return [bounds.max, (bounds.min + bounds.max) / 2, bounds.min];
}

test("niceInterval rounds raw intervals to 1/2/5 powers of ten", () => {
  assert.equal(niceInterval(0.14), 0.1);
  assert.equal(niceInterval(0.31), 0.2);
  assert.equal(niceInterval(3.6), 5);
  assert.equal(niceInterval(780), 1000);
});

test("createTickPlan promotes visible tick levels as zoom increases", () => {
  assert.deepEqual(
    createTickPlan(0.0005, 1000).levels.map((level) => level.name),
    ["long"],
  );
  assert.deepEqual(
    createTickPlan(0.01, 1000).levels.map((level) => level.name),
    ["long", "medium"],
  );
  assert.deepEqual(
    createTickPlan(1, 1000).levels.map((level) => level.name),
    ["long", "medium", "short"],
  );
  // Micro ticks would sit 1.6 px apart here, so they stay hidden until the viewport is tall enough.
  assert.deepEqual(
    createTickPlan(20, 1000).levels.map((level) => level.name),
    ["long", "medium", "short"],
  );
  assert.deepEqual(
    createTickPlan(20, 4000).levels.map((level) => level.name),
    ["long", "medium", "short", "micro"],
  );
});

test("createTickPlan shows a finer level only when its ticks are at least MIN_TICK_SPACING_PX apart", () => {
  for (const viewportHeight of [600, 800, 900, 1080, 2160, 4000]) {
    for (const pxPerMa of SWEEP_PX_PER_MA) {
      const plan = createTickPlan(pxPerMa, viewportHeight);

      assert.equal(plan.levels[0].name, "long", "the long level is always shown");
      for (const level of plan.levels.slice(1)) {
        assert.ok(
          level.intervalMa * pxPerMa >= MIN_TICK_SPACING_PX,
          `${level.name} level at ${pxPerMa} px/Ma, viewport ${viewportHeight}: ${level.intervalMa * pxPerMa} px apart`,
        );
      }
    }
  }
});

test("createTickPlan keeps micro ticks no finer than 1 kyr below 1e6 px/Ma, and allows 1 year at 1e6 px/Ma", () => {
  // At 1e5 px/Ma the micro interval is 0.00008 Ma (8 px apart): roomy enough, but finer than 1 kyr.
  assert.equal(createTickPlan(1e5, 4000).levels.some((level) => level.name === "micro"), false);

  // At 1e6 px/Ma the micro interval is 0.000008 Ma (8 px apart), and the 1 year floor lets it through.
  const micro = createTickPlan(1e6, 4000).levels.find((level) => level.name === "micro");
  assert.ok(micro);
  assert.ok(micro.intervalMa >= 1e-6);
});

test("maToY maps oldest dates to the top and newest dates toward the bottom", () => {
  const range = { viewMax: 100, viewMin: -50 };

  assert.equal(maToY(100, range, 2), 0);
  assert.equal(maToY(-50, range, 2), 300);
  assert.equal(yToMa(300, range, 2), -50);
});

test("getContentHeight reflects the current vertical zoom", () => {
  assert.equal(getContentHeight({ viewMax: 100, viewMin: 0 }, 3), 300);
});

test("getOffsetBounds centers short content and clamps tall content with half-viewport headroom", () => {
  assert.deepEqual(getOffsetBounds(200, 500), { min: 150, max: 150 });
  assert.deepEqual(getOffsetBounds(800, 500), { min: -550, max: 250 });
  assert.equal(clampOffset(300, { min: -550, max: 250 }), 250);
  assert.equal(clampOffset(-600, { min: -550, max: 250 }), -550);
});

test("getOffsetBounds keeps short content inside the margins it is given", () => {
  // Content that exactly fills the band between the margins locks at the top margin.
  assert.deepEqual(getOffsetBounds(452, 500, { top: 12, bottom: 36 }), { min: 12, max: 12 });
  // Shorter content centers within the band, not within the viewport.
  assert.deepEqual(getOffsetBounds(252, 500, { top: 12, bottom: 36 }), { min: 112, max: 112 });
  // Taller content keeps the half-viewport headroom regardless of the margins.
  assert.deepEqual(getOffsetBounds(800, 500, { top: 12, bottom: 36 }), { min: -550, max: 250 });
});

test("applyRubberDelta slows movement past the scroll bounds", () => {
  assert.equal(applyRubberDelta(0, 100, { min: -300, max: 0 }), 20);
  assert.equal(applyRubberDelta(-100, -50, { min: -300, max: 0 }), -150);
});

test("zoomAroundY keeps the date under the cursor stable before clamping", () => {
  const range = { viewMax: 100, viewMin: 0 };
  const zoomed = zoomAroundY({
    range,
    pxPerMa: 10,
    offsetY: 0,
    viewportY: 100,
    viewportHeight: 500,
    zoomFactor: 2,
  });

  assert.equal(zoomed.pxPerMa, 20);
  assert.equal(yToMa(100 - zoomed.offsetY, range, zoomed.pxPerMa), 90);
});

test("makeVisibleTicks terminates quickly when ma magnitude dwarfs the tick interval", () => {
  const range = { viewMin: -1.1e30, viewMax: -1e30 + 1000, span: 1.1e30, minMa: -1.1e30, maxMa: -1e30 + 1000 };
  const start = Date.now();
  const ticks = makeVisibleTicks({
    range,
    pxPerMa: 1,
    viewportHeight: 800,
    offsetY: 0,
  });

  assert.ok(Date.now() - start < 200, "tick generation must not hang");
  assert.ok(ticks.length < 2000, "tick generation must respect the safety cap");
});

test("makeVisibleTicks handles a heat-death-scale span without producing absurd tick counts", () => {
  const range = { viewMin: -1e104, viewMax: 1.4e4, span: 1e104, minMa: -1e104, maxMa: 13800 };
  const ticks = makeVisibleTicks({
    range,
    pxPerMa: 7e-102,
    viewportHeight: 800,
    offsetY: 0,
  });

  assert.ok(ticks.length > 0, "should still produce some ruler ticks");
  assert.ok(ticks.length < 50, `expected a small set of long ticks, got ${ticks.length}`);
  ticks.forEach((tick) => assert.ok(Number.isFinite(tick.y), "each tick y must be finite"));
});

test("makeVisibleTicks keeps tick levels spaced, bounded, and anchored across every zoom level", () => {
  for (const viewportHeight of [800, 900]) {
    for (const range of SWEEP_RANGES) {
      for (const pxPerMa of SWEEP_PX_PER_MA) {
        const longIntervalMa = createTickPlan(pxPerMa, viewportHeight).levels[0].intervalMa;

        for (const offsetY of sweepOffsets(range, pxPerMa, viewportHeight)) {
          const where = `viewport ${viewportHeight}, range ${range.viewMin}..${range.viewMax}, ${pxPerMa} px/Ma, offset ${offsetY}`;
          const ticks = makeVisibleTicks({ range, pxPerMa, viewportHeight, offsetY, referenceYear: 2026 });

          assert.ok(ticks.length < 400, `${ticks.length} ticks (${where})`);

          for (const level of ["long", "medium", "short", "micro"]) {
            const ys = ticks.filter((tick) => tick.level === level).map((tick) => tick.y);
            for (let index = 1; index < ys.length; index++) {
              assert.ok(
                ys[index] - ys[index - 1] >= MIN_TICK_SPACING_PX - 1e-3,
                `${level} ticks ${ys[index] - ys[index - 1]} px apart (${where})`,
              );
            }
          }

          if (range.viewMax - range.viewMin > longIntervalMa) {
            assert.ok(
              ticks.some((tick) => tick.level === "long"),
              `no long tick (${where})`,
            );
          }
        }
      }
    }
  }
});

test("makeVisibleTicks emits at most one tick per Ma and lets the coarser level keep a shared Ma", () => {
  const range = { viewMin: 0, viewMax: 4000 };
  // Offset -70000 px puts the visible window around 2000 Ma.
  const ticks = makeVisibleTicks({ range, pxPerMa: 35, viewportHeight: 800, offsetY: -70000 });
  const byMa = new Map();

  for (const tick of ticks) {
    assert.equal(byMa.has(tick.ma), false, `duplicate tick at ${tick.ma} Ma`);
    byMa.set(tick.ma, tick);
  }

  // Long ticks fall every 5 Ma, medium every 1 Ma, short every 0.2 Ma at this zoom, and 2000 Ma sits on all three.
  assert.deepEqual(
    createTickPlan(35, 800).levels.map((level) => [level.name, level.intervalMa]),
    [
      ["long", 5],
      ["medium", 1],
      ["short", 0.2],
    ],
  );
  assert.equal(byMa.get(2000)?.level, "long");
  assert.equal(byMa.get(2001)?.level, "medium");
  assert.equal(byMa.get(2000.2)?.level, "short");
});

test("makeVisibleTicks keeps the long-level tick count at 1 px/Ma", () => {
  const range = { viewMin: 0, viewMax: 4000 };
  const expectedLongCounts = [
    // The window is twice the viewport, centered in the range, with a long tick every 200 Ma (200 px). The long
    // level has no spacing or px/Ma gate, so these are the counts from before the spacing rule.
    [800, 9],
    [900, 10],
  ];

  for (const [viewportHeight, expectedCount] of expectedLongCounts) {
    const [, centeredOffsetY] = sweepOffsets(range, 1, viewportHeight);
    const ticks = makeVisibleTicks({ range, pxPerMa: 1, viewportHeight, offsetY: centeredOffsetY });
    const longTicks = ticks.filter((tick) => tick.level === "long");

    assert.ok(longTicks.length >= 4 && longTicks.length <= 12);
    assert.equal(longTicks.length, expectedCount);
    longTicks.forEach((tick) => assert.equal(tick.ma % 200, 0));
  }
});

test("formatCalendarYear switches recent Ma values to CE/BCE labels", () => {
  assert.equal(formatCalendarYear(0, 2026), "2026 CE");
  assert.equal(formatCalendarYear(0.0001, 2026), "1926 CE");
  assert.equal(formatCalendarYear(0.003, 2026), "975 BCE");
});
