import assert from "node:assert/strict";
import test from "node:test";

import { readFiniteUrlNumber } from "../src/lib/url-state.js";

test("missing timeline view parameters stay absent instead of becoming zero", () => {
  const params = new URLSearchParams("mode=climate&items=now");
  assert.equal(readFiniteUrlNumber(params, "zoom"), null);
  assert.equal(readFiniteUrlNumber(params, "offset"), null);
});

test("timeline view parameters accept finite numeric values", () => {
  const params = new URLSearchParams("zoom=31632.184&offset=35.84");
  assert.equal(readFiniteUrlNumber(params, "zoom"), 31632.184);
  assert.equal(readFiniteUrlNumber(params, "offset"), 35.84);
});
