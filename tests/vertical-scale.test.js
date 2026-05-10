import assert from "node:assert/strict";
import test from "node:test";

import {
  createTickPlan,
  formatCalendarYear,
  getContentHeight,
  maToY,
  niceInterval,
  yToMa,
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

test("formatCalendarYear switches recent Ma values to CE/BCE labels", () => {
  assert.equal(formatCalendarYear(0, 2026), "2026 CE");
  assert.equal(formatCalendarYear(0.0001, 2026), "1926 CE");
  assert.equal(formatCalendarYear(0.003, 2026), "975 BCE");
});
