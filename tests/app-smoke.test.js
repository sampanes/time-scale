import assert from "node:assert/strict";
import test from "node:test";

import { PRESETS, TIMELINE_ITEMS } from "../src/data/timeline-data.js";

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
    this.queryResults = {};
  }

  addEventListener(type, callback) {
    this.listeners[type] ||= [];
    this.listeners[type].push(callback);
  }

  querySelector(selector) {
    return this.queryResults[selector] ?? null;
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

function createFakeDom({ search = "", chrome = null } = {}) {
  const elements = Object.fromEntries(
    ["searchInput", "acList", "chips", "timelineContainer", "tooltip", "presetControls", "brandToggle", "searchCount"].map((id) => [
      id,
      new FakeElement(id),
    ]),
  );
  elements.appShell = new FakeElement("appShell");
  elements.addButton = new FakeElement("addButton");
  elements.clearButton = new FakeElement("clearButton");
  elements.timelineContainer.style.setProperty = function setProperty(name, value) {
    this[name] = value;
  };
  if (chrome) {
    elements.timelineContainer.queryResults[".timeline-toolbar"] = chrome.toolbar;
    elements.timelineContainer.queryResults[".timeline-readout"] = chrome.readout;
  }

  const listeners = { window: {}, document: {} };
  const resizeObservers = [];
  const urls = [];
  const frameQueue = new Map();
  let nextFrameId = 1;

  globalThis.window = {
    location: { search, pathname: "/", hash: "" },
    history: {
      replaceState(_state, _title, url) {
        urls.push(url);
      },
    },
    innerHeight: 800,
    innerWidth: 1200,
    matchMedia() {
      return { matches: false };
    },
    addEventListener(type, callback) {
      listeners.window[type] ||= [];
      listeners.window[type].push(callback);
    },
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
    addEventListener(type, callback) {
      listeners.document[type] ||= [];
      listeners.document[type].push(callback);
    },
    fonts: { ready: Promise.resolve() },
  };
  // The detail panel asks Wikipedia for a summary; keep the tests offline.
  globalThis.fetch = () => Promise.reject(new Error("offline in tests"));
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frameQueue.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frameQueue.delete(id);
  };
  globalThis.ResizeObserver = class {
    constructor(callback) {
      resizeObservers.push(callback);
    }

    observe() {}
  };

  const flushFrames = () => {
    const callbacks = [...frameQueue.values()];
    frameQueue.clear();
    callbacks.forEach((callback) => callback(performance.now()));
    return callbacks.length;
  };

  return {
    elements,
    listeners,
    resizeObservers,
    urls,
    flushFrames,
    pendingFrames: () => frameQueue.size,
    zoomOfLastUrl: () => new URLSearchParams(urls.at(-1)?.split("?")[1] ?? "").get("zoom"),
  };
}

let appInstance = 0;

// Each boot gets its own module instance so a test can start from a different URL.
async function bootApp(options) {
  const dom = createFakeDom(options);
  appInstance += 1;
  await import(`../src/app.js?instance=${appInstance}`);
  return dom;
}

const SHARE_ITEM_IDS = ["hadean", "proterozoic"];

test("app boot wires default presets, autocomplete, and add", async () => {
  const { elements } = await bootApp();

  assert.equal(elements.searchCount.textContent, `${TIMELINE_ITEMS.length.toLocaleString()} searchable timeline entries`);
  assert.match(elements.presetControls.innerHTML, /preset-drawer/);
  assert.match(elements.presetControls.innerHTML, /Deep time/);
  assert.match(elements.presetControls.innerHTML, /Human history/);
  assert.match(elements.presetControls.innerHTML, /Cosmos & stories/);
  assert.match(elements.presetControls.innerHTML, /Ages of Humankind/);
  assert.match(elements.presetControls.innerHTML, /Voyager 1&#039;s Journey/);
  assert.match(elements.timelineContainer.innerHTML, /empty-presets/);

  elements.searchInput.value = "hadean";
  elements.searchInput.listeners.input[0]();

  assert.equal(elements.acList.classList.contains("open"), true);
  assert.match(elements.acList.innerHTML, /Hadean/);

  elements.addButton.listeners.click[0]();

  assert.match(elements.chips.innerHTML, /Hadean/);
  assert.match(elements.timelineContainer.innerHTML, /event-segment/);

  elements.clearButton.listeners.click[0]();
  assert.doesNotMatch(elements.chips.innerHTML, /Hadean/);
  assert.match(elements.timelineContainer.innerHTML, /empty-presets/);
});

test("a share link keeps its zoom through fonts-ready, height changes, and window resize", async () => {
  SHARE_ITEM_IDS.forEach((id) => assert.ok(TIMELINE_ITEMS.some((item) => item.id === id), `${id} exists`));
  const dom = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}&zoom=100&offset=-40000` });
  const { elements, listeners, resizeObservers } = dom;

  assert.match(elements.timelineContainer.innerHTML, /timeline-stage/);
  assert.equal(resizeObservers.length, 1);
  assert.equal(listeners.window.resize?.length, 1);
  assert.equal(listeners.window.pagehide?.length, 1);

  // The web font swapped in and the header changed height.
  elements.timelineContainer.clientHeight = 700;
  resizeObservers[0]([]);
  await Promise.resolve();

  // The window was resized; the listener is debounced.
  listeners.window.resize[0]();
  await new Promise((resolve) => setTimeout(resolve, 250));

  // pagehide flushes the debounced URL write so the view state can be read back.
  listeners.window.pagehide[0]();
  assert.equal(dom.zoomOfLastUrl(), "100");
  assert.match(elements.timelineContainer.innerHTML, /height:700px/);
});

test("a fresh selection is still fit to a changed viewport height", async () => {
  const dom = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}` });
  const { elements, resizeObservers } = dom;

  dom.listeners.window.pagehide[0]();
  const fittedZoom = dom.zoomOfLastUrl();
  assert.notEqual(fittedZoom, null);

  elements.timelineContainer.clientHeight = 1240;
  resizeObservers[0]([]);
  dom.listeners.window.pagehide[0]();
  assert.notEqual(dom.zoomOfLastUrl(), fittedZoom);
});

test("wheel input coalesces into one render per animation frame", async () => {
  const dom = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}&zoom=100&offset=-100` });
  const { elements } = dom;

  assert.equal(dom.pendingFrames(), 0);
  const before = elements.timelineContainer.innerHTML;
  const wheel = elements.timelineContainer.listeners.wheel[0];
  let prevented = 0;
  const event = {
    deltaY: 40,
    ctrlKey: false,
    clientY: 300,
    preventDefault() {
      prevented += 1;
    },
  };

  wheel(event);
  wheel(event);
  wheel(event);

  assert.equal(prevented, 3);
  assert.equal(elements.timelineContainer.innerHTML, before, "the stage is not rewritten inside the wheel handler");
  assert.equal(dom.pendingFrames(), 1, "three wheel events schedule one frame");

  assert.equal(dom.flushFrames(), 1);
  assert.notEqual(elements.timelineContainer.innerHTML, before, "the next frame renders the panned stage");
  assert.equal(dom.pendingFrames(), 0);

  const ctrlEvent = { ...event, ctrlKey: true, deltaY: -120 };
  wheel(ctrlEvent);
  assert.equal(dom.pendingFrames(), 1);
  dom.flushFrames();
  dom.listeners.window.pagehide[0]();
  assert.notEqual(dom.zoomOfLastUrl(), "100");
});

test("a wheel fling past the bounds snaps back once the wheel goes quiet", async () => {
  const dom = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}&zoom=100&offset=-100` });
  const { elements } = dom;
  const wheel = elements.timelineContainer.listeners.wheel[0];
  const offsetOfLastUrl = () => Number(new URLSearchParams(dom.urls.at(-1)?.split("?")[1] ?? "").get("offset"));

  // Content is far taller than the viewport, so the top bound is half the viewport height.
  const topBound = elements.timelineContainer.clientHeight / 2;
  for (let i = 0; i < 20; i++) wheel({ deltaY: -4000, ctrlKey: false, clientY: 300, preventDefault() {} });
  dom.flushFrames();
  dom.listeners.window.pagehide[0]();
  assert.ok(offsetOfLastUrl() > topBound + 1000, "the fling rubber-bands well past the top bound");
  assert.equal(dom.pendingFrames(), 0);

  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(dom.pendingFrames(), 1, "the settle timer starts the snap animation");
  for (let i = 0; i < 40 && dom.pendingFrames() > 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    dom.flushFrames();
  }
  assert.equal(dom.pendingFrames(), 0, "the snap animation finishes");
  dom.listeners.window.pagehide[0]();
  assert.ok(Math.abs(offsetOfLastUrl() - topBound) < 1, `offset ${offsetOfLastUrl()} settles on the bound ${topBound}`);
});
test("renderPresets keeps an open drawer open", async () => {
  const { elements } = await bootApp();

  assert.match(elements.presetControls.innerHTML, /<details class="preset-drawer">/);

  elements.presetControls.queryResults[".preset-drawer"] = { open: true };
  elements.searchInput.value = "hadean";
  elements.searchInput.listeners.input[0]();
  elements.addButton.listeners.click[0]();
  assert.match(elements.presetControls.innerHTML, /<details class="preset-drawer" open>/);

  elements.presetControls.queryResults[".preset-drawer"] = { open: false };
  elements.clearButton.listeners.click[0]();
  assert.match(elements.presetControls.innerHTML, /<details class="preset-drawer">/);
});

test("keyboard shortcuts pan, zoom, fit, and skip editable targets", async () => {
  const dom = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}&zoom=100&offset=-100` });
  const { elements, listeners } = dom;
  const keydown = listeners.document.keydown[0];
  const fire = (key, extra = {}) => {
    let prevented = false;
    keydown({
      key,
      target: {},
      preventDefault() {
        prevented = true;
      },
      ...extra,
    });
    return prevented;
  };

  const before = elements.timelineContainer.innerHTML;
  assert.equal(fire("ArrowDown", { target: { tagName: "INPUT" } }), false);
  assert.equal(fire("ArrowDown", { target: { isContentEditable: true } }), false);
  assert.equal(fire("ArrowDown", { ctrlKey: true }), false);
  assert.equal(fire("x"), false);
  assert.equal(dom.pendingFrames(), 0);

  assert.equal(fire("ArrowDown"), true);
  assert.equal(dom.pendingFrames(), 1);
  dom.flushFrames();
  assert.notEqual(elements.timelineContainer.innerHTML, before);

  assert.equal(fire("+"), true);
  dom.flushFrames();
  listeners.window.pagehide[0]();
  assert.equal(dom.zoomOfLastUrl(), "125");

  assert.equal(fire("f"), true);
  listeners.window.pagehide[0]();
  assert.notEqual(dom.zoomOfLastUrl(), "125");

  elements.searchInput.value = "hadean";
  elements.searchInput.listeners.input[0]();
  assert.equal(elements.acList.classList.contains("open"), true);
  assert.equal(fire("Escape"), false);
  assert.equal(elements.acList.classList.contains("open"), false);
});

const LIVING_FOSSIL_IDS = PRESETS.find((preset) => preset.id === "living-fossils").itemIds;

function tapTimelineItem(dom, timelineId) {
  const container = dom.elements.timelineContainer;
  const target = {
    closest: (selector) => (selector === "[data-timeline-id]" ? { dataset: { timelineId } } : null),
  };
  const event = { target, pointerId: 7, pointerType: "mouse", button: 0, clientX: 300, clientY: 400, preventDefault() {} };
  container.listeners.pointerdown.forEach((listener) => listener(event));
  container.listeners.pointerup.forEach((listener) => listener(event));
}

async function settleFrames(dom, waitMs) {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  for (let round = 0; round < 200 && dom.pendingFrames() > 0; round++) dom.flushFrames();
  assert.equal(dom.pendingFrames(), 0, "the animation should finish");
}

function countMatches(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

test("stacked instants render one labeled leader, and tapping it spreads the stack instead of opening a detail", async () => {
  const dom = await bootApp({ search: `?items=${LIVING_FOSSIL_IDS.join(",")}` });
  dom.flushFrames();
  const html = dom.elements.timelineContainer.innerHTML;
  const points = countMatches(html, /class="event-point[ "]/g);
  const labels = countMatches(html, /event-point-label/g);
  const leader = html.match(/data-timeline-id="([^"]+)" data-cluster-size="(\d+)"/);

  assert.equal(points, LIVING_FOSSIL_IDS.length, "every instant still draws its line");
  assert.ok(labels < points, `labels should stack at fit, got ${labels} labels for ${points} points`);
  assert.ok(leader, "at least one stack has a leader with a count");
  assert.ok(html.includes(`+${Number(leader[2]) - 1}</span>`), "the leader shows how many more are stacked");

  dom.listeners.window.pagehide.forEach((listener) => listener());
  const zoomBefore = Number(dom.zoomOfLastUrl());

  tapTimelineItem(dom, leader[1]);
  await settleFrames(dom, 400);
  dom.listeners.window.pagehide.forEach((listener) => listener());
  const zoomAfter = Number(dom.zoomOfLastUrl());
  const after = dom.elements.timelineContainer.innerHTML;
  const leaderAfter = after.match(new RegExp(`data-timeline-id="${leader[1]}"( data-cluster-size="(\\d+)")?`));

  assert.ok(zoomAfter > zoomBefore * 1.4, `tap should zoom in, ${zoomBefore} -> ${zoomAfter}`);
  assert.ok(!after.includes("detail-panel"), "a stack tap opens no detail panel");
  assert.ok(leaderAfter, "the tapped leader is still on screen");
  assert.ok(!leaderAfter[2] || Number(leaderAfter[2]) < Number(leader[2]), "the stack is smaller after one tap");
});

test("tapping a lone instant opens its detail panel", async () => {
  const [first, second] = LIVING_FOSSIL_IDS;
  const dom = await bootApp({ search: `?items=${first},${second}` });
  dom.flushFrames();
  assert.ok(!dom.elements.timelineContainer.innerHTML.includes("data-cluster-size"), "two far instants do not stack");

  tapTimelineItem(dom, first);
  dom.flushFrames();

  assert.ok(dom.elements.timelineContainer.innerHTML.includes("detail-panel"), "the detail panel opens");
});

test("the stage starts below the floating toolbar and readout, and the fit uses what is left", async () => {
  const FIT_MARGINS_PX = 26 + 36; // FIT_MARGIN_TOP_PX + FIT_MARGIN_BOTTOM_PX in app.js
  const plain = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}` });
  plain.listeners.window.pagehide[0]();
  const plainZoom = Number(plain.zoomOfLastUrl());

  const chrome = { toolbar: { offsetTop: 12, offsetHeight: 40 }, readout: { offsetTop: 14, offsetHeight: 20 } };
  const dom = await bootApp({ search: `?items=${SHARE_ITEM_IDS.join(",")}`, chrome });
  const { elements, resizeObservers } = dom;
  dom.listeners.window.pagehide[0]();

  assert.equal(elements.timelineContainer.style["--stage-top"], "60px", "band = tallest chrome bottom + gap");
  assert.match(elements.timelineContainer.innerHTML, /height:560px/, "stage height = container minus the band");
  assert.ok(Math.abs(Number(dom.zoomOfLastUrl()) / plainZoom - (560 - FIT_MARGINS_PX) / (620 - FIT_MARGINS_PX)) < 1e-6, "the fit targets the stage, not the container");

  // The readout wrapped to two lines (narrow window): the band grows and the fitted view refits.
  chrome.readout.offsetHeight = 50;
  resizeObservers[0]([]);
  dom.listeners.window.pagehide[0]();

  assert.equal(elements.timelineContainer.style["--stage-top"], "72px");
  assert.match(elements.timelineContainer.innerHTML, /height:548px/);
  assert.ok(Math.abs(Number(dom.zoomOfLastUrl()) / plainZoom - (548 - FIT_MARGINS_PX) / (620 - FIT_MARGINS_PX)) < 1e-6, "a fitted view follows the band");
});
