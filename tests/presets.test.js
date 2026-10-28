import assert from "node:assert/strict";
import test from "node:test";

import { PRESET_GROUPS, PRESETS, TIMELINE_ITEMS } from "../src/data/timeline-data.js";

const itemsById = new Map(TIMELINE_ITEMS.map((item) => [item.id, item]));

test("every built-in preset item id exists and is listed once", () => {
  for (const preset of PRESETS) {
    const seen = new Set();

    for (const id of preset.itemIds) {
      assert.ok(itemsById.has(id), `${preset.id}: "${id}" is not a timeline item`);
      assert.ok(!seen.has(id), `${preset.id}: "${id}" is listed twice`);
      seen.add(id);
    }
  }
});

test("Living Fossils preset lists first-appearance instants, oldest first", () => {
  const expected = [
    ["stromatolites", "oldest-stromatolites"],
    ["cyanobacteria", "first-cyanobacteria"],
    ["sponges", "first-sponges"],
    ["brachiopods", "first-brachiopods"],
    ["jellyfish", "first-jellyfish"],
    ["nautiloids", "first-nautiloids"],
    ["crinoids", "first-crinoids"],
    ["horseshoe crabs", "first-horseshoe-crabs"],
    ["scorpions", "first-scorpions"],
    ["lungfish", "first-lungfish"],
    ["coelacanth", "first-coelacanths"],
    ["lampreys", "first-lampreys"],
    ["cockroaches", "first-cockroaches"],
    ["hagfish", "first-hagfish"],
    ["velvet worms", "first-velvet-worms"],
    ["cycads", "first-cycads"],
    ["ginkgo", "first-ginkgos"],
    ["tuatara", "first-rhynchocephalians"],
    ["turtles", "first-turtles"],
    ["platypus", "monotreme-divergence"],
    ["horsetails", "first-horsetails"],
    ["royal ferns", "first-royal-ferns"],
    ["giant salamanders", "first-giant-salamanders"],
    ["gars", "first-gars"],
    ["welwitschia", "first-welwitschia"],
    ["sturgeons", "first-sturgeons"],
    ["crocodilians", "first-crocodilians"],
    ["dawn redwood", "first-dawn-redwoods"],
    ["wollemi pine", "first-wollemi-pines"],
  ];
  const preset = PRESETS.find((candidate) => candidate.id === "living-fossils");

  assert.ok(preset, "living-fossils preset is defined");
  assert.deepEqual(preset.itemIds, expected.map(([, id]) => id));

  let previousStart = Infinity;

  for (const [, id] of expected) {
    const item = itemsById.get(id);

    assert.ok(item, `${id} is not a timeline item`);
    assert.equal(item.start_ma, item.end_ma, `${id} must render as a line, not a span`);
    assert.ok(item.start_ma <= previousStart, `${id} is out of oldest-first order`);
    assert.ok(item.note, `${id} should carry a note explaining the date`);
    previousStart = item.start_ma;
  }
});

test("Origin Myths preset lists noted works, oldest first", () => {
  const preset = PRESETS.find((candidate) => candidate.id === "origin-myths");

  assert.ok(preset, "origin-myths preset is defined");

  let previousStart = Infinity;

  for (const id of preset.itemIds) {
    const item = itemsById.get(id);

    assert.equal(item.type, "work", `${id} should be a work dated by its source`);
    assert.ok(item.start_ma <= previousStart, `${id} is out of oldest-first order`);
    assert.ok(item.note, `${id} should carry a note explaining the date`);
    previousStart = item.start_ma;
  }
});

test("every preset belongs to a known group and groups are unique", () => {
  assert.equal(new Set(PRESET_GROUPS).size, PRESET_GROUPS.length, "PRESET_GROUPS has duplicates");

  for (const preset of PRESETS) {
    assert.ok(PRESET_GROUPS.includes(preset.group), `${preset.id}: group "${preset.group}" is not in PRESET_GROUPS`);
  }
});
