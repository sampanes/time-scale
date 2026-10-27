import assert from "node:assert/strict";
import test from "node:test";

import { PRESETS, TIMELINE_ITEMS } from "../src/data/timeline-data.js";
import { searchTimelineItems } from "../src/lib/search.js";

const resolve = (query) => searchTimelineItems(TIMELINE_ITEMS, query)[0];

test("every built-in preset query resolves to a distinct timeline item", () => {
  for (const preset of PRESETS) {
    const seen = new Map();

    for (const query of preset.queries) {
      const item = resolve(query);

      assert.ok(item, `${preset.id}: "${query}" matched nothing`);
      assert.ok(!seen.has(item.id), `${preset.id}: "${query}" and "${seen.get(item.id)}" both resolve to ${item.id}`);
      seen.set(item.id, query);
    }
  }
});

test("Living Fossils preset resolves to first-appearance instants, oldest first", () => {
  const expected = [
    ["stromatolites", "oldest-stromatolites"],
    ["cyanobacteria", "first-cyanobacteria"],
    ["sponges", "first-sponges"],
    ["brachiopods", "first-brachiopods"],
    ["jellyfish", "first-jellyfish"],
    ["nautiloids", "first-nautiloids"],
    ["crinoids", "first-crinoids"],
    ["horseshoe crabs", "first-horseshoe-crabs"],
    ["lungfish", "first-lungfish"],
    ["coelacanth", "first-coelacanths"],
    ["lampreys", "first-lampreys"],
    ["cockroaches", "first-cockroaches"],
    ["velvet worms", "first-velvet-worms"],
    ["cycads", "first-cycads"],
    ["ginkgo", "first-ginkgos"],
    ["tuatara", "first-rhynchocephalians"],
    ["platypus", "monotreme-divergence"],
    ["horsetails", "first-horsetails"],
    ["welwitschia", "first-welwitschia"],
    ["sturgeons", "first-sturgeons"],
    ["crocodilians", "first-crocodilians"],
    ["dawn redwood", "first-dawn-redwoods"],
    ["wollemi pine", "first-wollemi-pines"],
  ];
  const preset = PRESETS.find((candidate) => candidate.id === "living-fossils");

  assert.ok(preset, "living-fossils preset is defined");
  assert.deepEqual(preset.queries, expected.map(([query]) => query));

  let previousStart = Infinity;

  for (const [query, id] of expected) {
    const item = resolve(query);

    assert.equal(item?.id, id, `"${query}" should resolve to ${id}`);
    assert.equal(item.start_ma, item.end_ma, `${id} must render as a line, not a span`);
    assert.ok(item.start_ma <= previousStart, `${id} is out of oldest-first order`);
    assert.ok(item.note, `${id} should carry a note explaining the date`);
    previousStart = item.start_ma;
  }
});
