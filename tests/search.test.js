import assert from "node:assert/strict";
import test from "node:test";

import { TIMELINE_ITEMS } from "../src/data/timeline-data.js";
import { fuzzyScore, normalizeSearchText, searchTimelineItems } from "../src/lib/search.js";

test("normalizeSearchText lowers case and strips punctuation", () => {
  assert.equal(normalizeSearchText("K-Pg Mass Extinction!"), "k pg mass extinction");
});

test("fuzzyScore prefers exact and prefix matches over loose matches", () => {
  assert.equal(fuzzyScore("triassic", "triassic"), 100);
  assert.ok(fuzzyScore("tria", "triassic") > fuzzyScore("tsc", "triassic"));
});

test("searchTimelineItems finds aliases and limits results", () => {
  const results = searchTimelineItems(TIMELINE_ITEMS, "chicxulub", { limit: 3 });

  assert.equal(results[0].id, "mass-extinction-kpg");
  assert.ok(results.length <= 3);
});
