import assert from "node:assert/strict";
import test from "node:test";

import {
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
  assert.deepEqual(
    createTickPlan(20, 1000).levels.map((level) => level.name),
    ["long", "medium", "short", "micro"],
  );
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
  const range = { viewMin: -1.1e32, viewMax: 1.4e4, span: 1.1e32, minMa: -1e32, maxMa: 13800 };
  const ticks = makeVisibleTicks({
    range,
    pxPerMa: 1e-30,
    viewportHeight: 800,
    offsetY: 0,
  });

  assert.ok(ticks.length > 0, "should still produce some ruler ticks");
  assert.ok(ticks.length < 50, `expected a small set of long ticks, got ${ticks.length}`);
  ticks.forEach((tick) => assert.ok(Number.isFinite(tick.y), "each tick y must be finite"));
});

test("formatCalendarYear switches recent Ma values to CE/BCE labels", () => {
  assert.equal(formatCalendarYear(0, 2026), "2026 CE");
  assert.equal(formatCalendarYear(0.0001, 2026), "1926 CE");
  assert.equal(formatCalendarYear(0.003, 2026), "975 BCE");
});
