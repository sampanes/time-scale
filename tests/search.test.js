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

test("searchTimelineItems includes scratchpad geology and future additions", () => {
  assert.equal(searchTimelineItems(TIMELINE_ITEMS, "azolla")[0].id, "azolla-event");
  assert.equal(searchTimelineItems(TIMELINE_ITEMS, "milkomeda")[0].id, "milkomeda-collision");
  assert.equal(searchTimelineItems(TIMELINE_ITEMS, "betelgeuse")[0].id, "betelgeuse-supernova");
});

test("renamed extinction entries remain searchable and render as spans", () => {
  for (const [query, id] of [
    ["wooly mammoth extinction", "woolly-mammoth"],
    ["dodo extinction", "dodo-extinction"],
    ["passenger pigeon extinction", "passenger-pigeon-extinction"],
  ]) {
    const result = searchTimelineItems(TIMELINE_ITEMS, query)[0];

    assert.equal(result.id, id);
    assert.notEqual(result.start_ma, result.end_ma);
    assert.doesNotMatch(result.name, /extinction/i);
  }
});

test("searchTimelineItems finds curated people by aliases and ascii spellings", () => {
  for (const [query, id] of [
    ["buddha", "person-siddhartha-gautama"],
    ["schrodinger", "person-erwin-schrodinger"],
    ["garcia marquez", "person-gabriel-garcia-marquez"],
    ["sultan of swat", "person-babe-ruth"],
  ]) {
    const result = searchTimelineItems(TIMELINE_ITEMS, query)[0];

    assert.equal(result.id, id);
    assert.equal(result.type, "person");
    assert.notEqual(result.start_ma, result.end_ma);
  }
});

test("searchTimelineItems finds great works by aliases", () => {
  for (const [query, id] of [
    ["gilgamesh", "work-epic-of-gilgamesh"],
    ["colloseum", "work-colosseum"],
    ["statue of david", "work-david"],
    ["mona lisa", "work-mona-lisa"],
    ["iphone", "work-iphone"],
  ]) {
    const result = searchTimelineItems(TIMELINE_ITEMS, query)[0];

    assert.equal(result.id, id);
    assert.equal(result.type, "work");
    assert.notEqual(result.start_ma, result.end_ma);
  }
});
