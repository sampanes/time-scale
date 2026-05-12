import assert from "node:assert/strict";
import test from "node:test";

import { TIMELINE_ITEMS } from "../src/data/timeline-data.js";

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  add(className) {
    this.classes.add(className);
  }

  remove(className) {
    this.classes.delete(className);
  }

  toggle(className, force) {
    if (force ?? !this.classes.has(className)) {
      this.classes.add(className);
    } else {
      this.classes.delete(className);
    }
  }

  contains(className) {
    return this.classes.has(className);
  }
}

class FakeElement {
  constructor(id) {
    this.id = id;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.listeners = {};
    this.classList = new FakeClassList();
    this.style = {};
    this.clientHeight = 620;
  }

  addEventListener(type, callback) {
    this.listeners[type] ||= [];
    this.listeners[type].push(callback);
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  focus() {
    this.focused = true;
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  getBoundingClientRect() {
    return { top: 0 };
  }
}

function createFakeDom() {
  const elements = Object.fromEntries(
    ["searchInput", "acList", "chips", "timelineContainer", "tooltip", "presetControls", "brandToggle", "searchCount"].map((id) => [
      id,
      new FakeElement(id),
    ]),
  );
  elements.appShell = new FakeElement("appShell");
  elements.addButton = new FakeElement("addButton");
  elements.clearButton = new FakeElement("clearButton");

  globalThis.window = {
    location: { search: "", pathname: "/", hash: "" },
    history: { replaceState() {} },
    innerHeight: 800,
    innerWidth: 1200,
    matchMedia() {
      return { matches: false };
    },
    addEventListener() {},
  };
  globalThis.document = {
    getElementById(id) {
      return elements[id];
    },
    querySelector(selector) {
      if (selector === ".app-shell") return elements.appShell;
      if (selector === "[data-action='add']") return elements.addButton;
      if (selector === "[data-action='clear']") return elements.clearButton;
      return null;
    },
    addEventListener() {},
  };
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};

  return elements;
}

test("app boot wires default presets, autocomplete, and add", async () => {
  const elements = createFakeDom();

  await import("../src/app.js");

  assert.equal(elements.searchCount.textContent, `${TIMELINE_ITEMS.length.toLocaleString()} searchable events`);
  assert.match(elements.presetControls.innerHTML, /Presets/);
  assert.match(elements.timelineContainer.innerHTML, /empty-presets/);

  elements.searchInput.value = "hadean";
  elements.searchInput.listeners.input[0]();

  assert.equal(elements.acList.classList.contains("open"), true);
  assert.match(elements.acList.innerHTML, /Hadean/);

  elements.addButton.listeners.click[0]();

  assert.match(elements.chips.innerHTML, /Hadean/);
  assert.match(elements.timelineContainer.innerHTML, /event-segment/);
});
