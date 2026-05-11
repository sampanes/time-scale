import { PRESETS, TIMELINE_ITEMS, TYPE_COLORS } from "./data/timeline-data.js";
import { searchTimelineItems } from "./lib/search.js";
import { buildVerticalTimelineViewModel, getVerticalTimelineRange } from "./lib/timeline-view-model.js";
import { ZOOM_BOUNDS, applyRubberDelta, clampOffset, getContentHeight, getOffsetBounds, zoomAroundY } from "./lib/vertical-scale.js";
import { formatDurationMa, formatMa, getItemDurationMa } from "./lib/time-scale.js";

let selectedItems = [];
let selectedDetailId = null;
let autocompleteIndex = -1;

const viewState = {
  pxPerMa: 1,
  offsetY: 0,
  selectionKey: "",
  animationFrame: null,
  urlFrame: null,
};

const uiState = {
  chromeCollapsed: false,
  shareCopied: false,
  shareResetTimer: null,
};

const pointerState = {
  pointers: new Map(),
  primaryPointerId: null,
  startX: null,
  startY: null,
  lastY: null,
  lastPinchDistance: null,
  tapCandidateId: null,
  hasMoved: false,
};

const TAP_MOVE_THRESHOLD_PX = 8;
const STORAGE_KEYS = {
  hiddenPresets: "timeScale_hidden_presets",
  customPresets: "timeScale_custom_presets",
};
const volatileStorage = new Map();

const elements = {
  appShell: document.querySelector(".app-shell"),
  brandToggle: document.getElementById("brandToggle"),
  searchInput: document.getElementById("searchInput"),
  autocompleteList: document.getElementById("acList"),
  chips: document.getElementById("chips"),
  timelineContainer: document.getElementById("timelineContainer"),
  tooltip: document.getElementById("tooltip"),
  presetControls: document.getElementById("presetControls"),
  addButton: document.querySelector("[data-action='add']"),
  clearButton: document.querySelector("[data-action='clear']"),
};

function findTimelineItem(id) {
  return TIMELINE_ITEMS.find((item) => item.id === id);
}

function getSelectionKey() {
  return selectedItems.map((item) => item.id).join("|");
}

function search(query) {
  return searchTimelineItems(TIMELINE_ITEMS, query);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readStorageValue(key) {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // Storage may be blocked by the browser or unavailable in tests.
  }

  return volatileStorage.get(key) ?? null;
}

function writeStorageValue(key, value) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fall through to session-only storage.
  }

  volatileStorage.set(key, value);
}

function removeStorageValue(key) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // Fall through to session-only storage.
  }

  volatileStorage.delete(key);
}

function readStoredArray(key) {
  const rawValue = readStorageValue(key);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredArray(key, value) {
  writeStorageValue(key, JSON.stringify(value));
}

function getHiddenPresets() {
  return readStoredArray(STORAGE_KEYS.hiddenPresets);
}

function getCustomPresets() {
  return readStoredArray(STORAGE_KEYS.customPresets);
}

function renderPresets() {
  const hidden = getHiddenPresets();
  const customs = getCustomPresets();
  const visibleBuiltins = PRESETS.filter((p) => !hidden.includes(p.id));

  const builtinsHtml = visibleBuiltins
    .map(
      (p) => `
    <div class="preset-item">
      <button class="preset-btn" type="button" data-preset-id="${p.id}">${escapeHtml(p.label)}</button>
      <button class="preset-delete" type="button" data-delete-id="${p.id}" title="Hide preset">×</button>
    </div>
  `,
    )
    .join("");

  const customsHtml = customs
    .map(
      (p) => `
    <div class="preset-item">
      <button class="preset-btn" type="button" data-preset-id="${p.id}">${escapeHtml(p.label)}</button>
      <button class="preset-delete" type="button" data-delete-id="${p.id}" title="Delete preset">×</button>
    </div>
  `,
    )
    .join("");

  elements.presetControls.innerHTML = `
    <span class="preset-label">Presets</span>
    ${builtinsHtml}
    ${customsHtml}
    <button class="btn-text" type="button" data-action="save-preset" ${
      selectedItems.length === 0 ? 'disabled style="opacity: 0.3; cursor: default;"' : ""
    }>+ Save current</button>
    ${
      hidden.length > 0 || customs.length > 0
        ? `<button class="btn-text" type="button" data-action="reset-presets">Reset all</button>`
        : ""
    }
  `;
}

function openAutocomplete(results) {
  elements.autocompleteList.innerHTML = results
    .map(
      (item) => `
        <button class="ac-item" type="button" data-id="${item.id}">
          <span>${escapeHtml(item.name)}</span>
          <span class="ac-type">${escapeHtml(item.type)}</span>
        </button>
      `,
    )
    .join("");
  elements.autocompleteList.classList.add("open");
}

function closeAutocomplete() {
  elements.autocompleteList.classList.remove("open");
  autocompleteIndex = -1;
}

function highlightAutocomplete(items) {
  items.forEach((element, index) => element.classList.toggle("selected", index === autocompleteIndex));
}

function selectItem(id) {
  const item = findTimelineItem(id);
  if (!item) return;

  if (!selectedItems.find((selected) => selected.id === id)) {
    selectedItems.push(item);
    markSelectionChanged();
    renderChips();
    renderTimeline();
  }

  elements.searchInput.value = "";
  closeAutocomplete();
  elements.searchInput.focus();
}

function addFromInput() {
  const query = elements.searchInput.value.trim();
  if (!query) return;

  const results = search(query);
  if (results.length) selectItem(results[0].id);
}

function removeItem(id) {
  selectedItems = selectedItems.filter((item) => item.id !== id);
  if (selectedDetailId === id) selectedDetailId = null;
  markSelectionChanged();
  renderChips();
  renderTimeline();
}

function clearAll() {
  selectedItems = [];
  selectedDetailId = null;
  markSelectionChanged();
  renderChips();
  renderTimeline();
}

function loadPreset(presetId) {
  const customs = getCustomPresets();
  let preset = PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) {
    preset = customs.find((candidate) => candidate.id === presetId);
  }

  if (!preset) return;

  selectedItems = [];

  if (preset.queries) {
    for (const query of preset.queries) {
      const [item] = search(query);
      if (item && !selectedItems.find((selected) => selected.id === item.id)) {
        selectedItems.push(item);
      }
    }
  } else if (preset.itemIds) {
    for (const id of preset.itemIds) {
      const item = findTimelineItem(id);
      if (item) selectedItems.push(item);
    }
  }

  selectedDetailId = null;
  markSelectionChanged();
  renderChips();
  renderTimeline();
}

function saveCurrentAsPreset() {
  if (selectedItems.length === 0) return;

  const label = prompt("Enter a name for this preset:");
  if (!label) return;

  const customs = getCustomPresets();
  const id = `custom-${Date.now()}`;
  const itemIds = selectedItems.map((item) => item.id);

  customs.push({ id, label, itemIds });
  writeStoredArray(STORAGE_KEYS.customPresets, customs);

  renderPresets();
}

function deletePreset(id) {
  if (id.startsWith("custom-")) {
    const customs = getCustomPresets();
    const filtered = customs.filter((p) => p.id !== id);
    writeStoredArray(STORAGE_KEYS.customPresets, filtered);
  } else {
    const hidden = getHiddenPresets();
    if (!hidden.includes(id)) {
      hidden.push(id);
      writeStoredArray(STORAGE_KEYS.hiddenPresets, hidden);
    }
  }

  renderPresets();
}

function resetPresets() {
  removeStorageValue(STORAGE_KEYS.customPresets);
  removeStorageValue(STORAGE_KEYS.hiddenPresets);
  renderPresets();
}

function markSelectionChanged() {
  viewState.selectionKey = "";
  if (selectedDetailId && !selectedItems.some((item) => item.id === selectedDetailId)) {
    selectedDetailId = null;
  }
  renderPresets();
}

function renderChips() {
  if (!selectedItems.length) {
    elements.chips.innerHTML = '<span class="empty-chip">No items selected</span>';
    return;
  }

  elements.chips.innerHTML = selectedItems
    .map(
      (item) => `
        <div class="chip">
          <span>${escapeHtml(item.name)}</span>
          <button class="chip-x" type="button" data-remove-id="${item.id}" aria-label="Remove ${escapeHtml(item.name)}">&times;</button>
        </div>
      `,
    )
    .join("");
}

function applyChromeState() {
  elements.appShell.classList.toggle("chrome-collapsed", uiState.chromeCollapsed);
  elements.brandToggle.setAttribute("aria-expanded", String(!uiState.chromeCollapsed));
}

function setChromeCollapsed(collapsed) {
  uiState.chromeCollapsed = collapsed;
  applyChromeState();
  scheduleUrlStateUpdate();

  requestAnimationFrame(() => {
    snapOffsetToBounds();
    renderTimeline();
  });
}

function selectTimelineDetail(id) {
  if (!selectedItems.some((item) => item.id === id)) return;

  selectedDetailId = id;
  renderTimeline();
}

function closeTimelineDetail() {
  selectedDetailId = null;
  renderTimeline();
}

function renderTimelineToolbar(isEnabled) {
  const disabled = isEnabled ? "" : " disabled";
  const shareLabel = uiState.shareCopied ? "Copied" : "Share";

  return `
    <div class="timeline-toolbar" aria-label="Timeline controls">
      <button class="tool-btn" type="button" data-view-action="fit" title="Fit selection"${disabled}>Fit</button>
      <button class="tool-btn icon-btn" type="button" data-view-action="zoom-out" title="Zoom out"${disabled}>-</button>
      <button class="tool-btn icon-btn" type="button" data-view-action="zoom-in" title="Zoom in"${disabled}>+</button>
      <button class="tool-btn" type="button" data-view-action="share" title="Copy share link"${disabled}>${shareLabel}</button>
    </div>
  `;
}

function renderDetailPanel() {
  if (!selectedDetailId) return "";

  const item = selectedItems.find((candidate) => candidate.id === selectedDetailId);
  if (!item) return "";

  const duration = getItemDurationMa(item);
  const aliases = item.aliases?.length ? item.aliases.slice(0, 5).join(", ") : "None";

  return `
    <aside class="detail-panel" aria-label="Selected timeline item">
      <button class="detail-close" type="button" data-detail-action="close" aria-label="Close details">&times;</button>
      <div class="detail-name">${escapeHtml(item.name)}</div>
      <div class="detail-grid">
        <div>Type</div><span>${escapeHtml(item.type)}</span>
        <div>Start</div><span>${formatMa(item.start_ma)}</span>
        <div>End</div><span>${formatMa(item.end_ma)}</span>
        <div>Duration</div><span>${duration > 0 ? formatDurationMa(duration) : "Point event"}</span>
      </div>
      <div class="detail-aliases">
        <div>Aliases</div>
        <span>${escapeHtml(aliases)}</span>
      </div>
    </aside>
  `;
}

function renderEmptyPresetPicker() {
  const hidden = getHiddenPresets();
  const customs = getCustomPresets();
  const visibleBuiltins = PRESETS.filter((p) => !hidden.includes(p.id));

  const builtinsHtml = visibleBuiltins
    .map((preset) => `<button class="preset-btn" type="button" data-preset-id="${preset.id}">${escapeHtml(preset.label)}</button>`)
    .join("");

  const customsHtml = customs
    .map((preset) => `<button class="preset-btn" type="button" data-preset-id="${preset.id}">${escapeHtml(preset.label)}</button>`)
    .join("");

  return `
    <div class="empty-presets" aria-label="Default timelines">
      <span>Presets</span>
      ${builtinsHtml}
      ${customsHtml}
    </div>
  `;
}

function fitCurrentSelection() {
  if (!hasSelection()) return;

  fitSelectionToViewport(getCurrentRange(), getTimelineViewportHeight());
  renderTimeline();
}

function handleViewAction(action) {
  if (action === "fit") {
    fitCurrentSelection();
  } else if (action === "zoom-in") {
    zoomAt(getTimelineViewportHeight() / 2, 1.25);
  } else if (action === "zoom-out") {
    zoomAt(getTimelineViewportHeight() / 2, 0.8);
  } else if (action === "share") {
    shareCurrentUrl();
  }
}

async function shareCurrentUrl() {
  writeUrlState();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
    }
  } catch {
    // Clipboard access can be blocked outside HTTPS or without a direct gesture.
  }

  uiState.shareCopied = true;
  renderTimeline();

  if (uiState.shareResetTimer !== null) clearTimeout(uiState.shareResetTimer);
  uiState.shareResetTimer = setTimeout(() => {
    uiState.shareCopied = false;
    uiState.shareResetTimer = null;
    renderTimeline();
  }, 1200);
}

function readInitialUrlState() {
  const params = new URLSearchParams(window.location.search);
  const itemIds = (params.get("items") || "").split(",").filter(Boolean);
  selectedItems = itemIds.map((id) => findTimelineItem(id)).filter(Boolean);

  const detailId = params.get("selected");
  selectedDetailId = selectedItems.some((item) => item.id === detailId) ? detailId : null;

  const pxPerMa = Number(params.get("zoom"));
  const offsetY = Number(params.get("offset"));
  if (Number.isFinite(pxPerMa) && pxPerMa > 0) viewState.pxPerMa = pxPerMa;
  if (Number.isFinite(offsetY)) viewState.offsetY = offsetY;
  if (selectedItems.length && Number.isFinite(pxPerMa) && Number.isFinite(offsetY)) {
    viewState.selectionKey = getSelectionKey();
  }

  uiState.chromeCollapsed = params.get("compact") === "1";
}

function scheduleUrlStateUpdate() {
  if (viewState.urlFrame !== null) return;

  viewState.urlFrame = requestAnimationFrame(() => {
    viewState.urlFrame = null;
    writeUrlState();
  });
}

function writeUrlState() {
  const params = new URLSearchParams();

  if (selectedItems.length) {
    params.set("items", selectedItems.map((item) => item.id).join(","));
    params.set("zoom", formatUrlNumber(viewState.pxPerMa));
    params.set("offset", formatUrlNumber(viewState.offsetY));
  }

  if (selectedDetailId) params.set("selected", selectedDetailId);
  if (uiState.chromeCollapsed) params.set("compact", "1");

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function formatUrlNumber(value) {
  return Number(value.toPrecision(8)).toString();
}

function renderTimeline() {
  if (!selectedItems.length) {
    elements.timelineContainer.innerHTML = `
      ${renderTimelineToolbar(false)}
      <div class="empty">
        <div class="empty-big">Nothing selected yet</div>
        <small>Search above or try a preset.</small>
        ${renderEmptyPresetPicker()}
      </div>
    `;
    scheduleUrlStateUpdate();
    return;
  }

  const viewportHeight = getTimelineViewportHeight();
  const selectionKey = getSelectionKey();
  const range = getVerticalTimelineRange(selectedItems);

  if (viewState.selectionKey !== selectionKey) {
    fitSelectionToViewport(range, viewportHeight);
    viewState.selectionKey = selectionKey;
  }

  const viewModel = buildVerticalTimelineViewModel(selectedItems, {
    pxPerMa: viewState.pxPerMa,
    viewportHeight,
    offsetY: viewState.offsetY,
    typeColors: TYPE_COLORS,
  });

  const renderOffsetY = viewState.offsetY;
  const cullSlack = Math.max(viewportHeight, 400);
  const viewportTop = -cullSlack;
  const viewportBottom = viewportHeight + cullSlack;

  const ticksHtml = viewModel.ticks
    .map((tick) => renderTick(tick, renderOffsetY, viewportTop, viewportBottom))
    .join("");
  const segmentsHtml = viewModel.segments
    .map((segment) => renderVerticalSegment(segment, renderOffsetY, viewportTop, viewportBottom))
    .join("");
  const nowHtml = renderNowLine(viewModel.nowY, renderOffsetY, viewportTop, viewportBottom);

  elements.timelineContainer.innerHTML = `
    ${renderTimelineToolbar(true)}
    <div class="timeline-readout">
      <div>
        <span>${viewModel.labels.rangeStart}</span>
        <span class="readout-arrow">to</span>
        <span>${viewModel.labels.rangeEnd}</span>
      </div>
      <div>${viewModel.labels.span} span / ${viewModel.selectedCount} selected / Ma = million years</div>
    </div>
    <div class="timeline-stage" style="height:${viewportHeight}px;">
      <div class="ruler-column">${ticksHtml}</div>
      <div class="event-column">${segmentsHtml}${nowHtml}</div>
    </div>
    ${renderDetailPanel()}
  `;
  scheduleUrlStateUpdate();
}

function renderTick(tick, offsetY, viewportTop, viewportBottom) {
  const y = tick.y + offsetY;
  if (!Number.isFinite(y) || y < viewportTop || y > viewportBottom) return "";

  return `
    <div class="ruler-tick ruler-tick-${tick.level}" style="top:${y}px;--tick-width:${tick.widthPct}%;">
      <div class="ruler-tick-line"></div>
      ${tick.label ? `<div class="ruler-tick-label">${escapeHtml(tick.label)}</div>` : ""}
    </div>
  `;
}

function renderVerticalSegment(segment, offsetY, viewportTop, viewportBottom) {
  const colorStyle = `--item-color:${segment.color};`;

  if (segment.isPoint) {
    const y = segment.y + offsetY;
    if (!Number.isFinite(y) || y < viewportTop || y > viewportBottom) return "";

    return `
      <div class="event-point" style="top:${y}px;z-index:${segment.zIndex};${colorStyle}" data-timeline-id="${segment.id}">
        <div class="event-point-line"></div>
        <div class="event-point-label">${escapeHtml(segment.name)}</div>
      </div>
    `;
  }

  const top = segment.top + offsetY;
  const bottom = top + segment.height;
  if (!Number.isFinite(top) || bottom < viewportTop || top > viewportBottom) return "";

  const clampedTop = Math.max(top, viewportTop);
  const clampedBottom = Math.min(bottom, viewportBottom);
  const clampedHeight = Math.max(clampedBottom - clampedTop, 2);
  const compactClass = segment.height < 34 ? " compact" : "";

  return `
    <div
      class="event-segment${compactClass}"
      style="top:${clampedTop}px;height:${clampedHeight}px;z-index:${segment.zIndex};${colorStyle}"
      data-timeline-id="${segment.id}"
    >
      <span class="event-segment-label">${escapeHtml(segment.name)}</span>
    </div>
  `;
}

function renderNowLine(nowY, offsetY, viewportTop, viewportBottom) {
  if (nowY === null) return "";

  const y = nowY + offsetY;
  if (!Number.isFinite(y) || y < viewportTop || y > viewportBottom) return "";

  return `<div class="now-line" style="top:${y}px"><span>Now</span></div>`;
}

function getTimelineViewportHeight() {
  return Math.max(320, elements.timelineContainer.clientHeight || Math.floor(window.innerHeight * 0.68));
}

function fitSelectionToViewport(range, viewportHeight) {
  const spanMa = Math.max(range.viewMax - range.viewMin, 1e-9);
  const targetHeight = viewportHeight * 0.86;
  viewState.pxPerMa = clamp(targetHeight / spanMa, ZOOM_BOUNDS.minPxPerMa, ZOOM_BOUNDS.maxPxPerMa);
  viewState.offsetY = (viewportHeight - getContentHeight(range, viewState.pxPerMa)) / 2;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hasSelection() {
  return selectedItems.length > 0;
}

function getCurrentRange() {
  return getVerticalTimelineRange(selectedItems);
}

function getCurrentBounds(range = getCurrentRange(), viewportHeight = getTimelineViewportHeight()) {
  return getOffsetBounds(getContentHeight(range, viewState.pxPerMa), viewportHeight);
}

function panBy(deltaY) {
  if (!hasSelection()) return;

  cancelOffsetAnimation();
  const range = getCurrentRange();
  const bounds = getCurrentBounds(range);
  viewState.offsetY = applyRubberDelta(viewState.offsetY, deltaY, bounds);
  renderTimeline();
}

function zoomAt(viewportY, zoomFactor) {
  if (!hasSelection()) return;

  cancelOffsetAnimation();
  const viewportHeight = getTimelineViewportHeight();
  const next = zoomAroundY({
    range: getCurrentRange(),
    pxPerMa: viewState.pxPerMa,
    offsetY: viewState.offsetY,
    viewportY,
    viewportHeight,
    zoomFactor,
  });

  viewState.pxPerMa = next.pxPerMa;
  viewState.offsetY = next.offsetY;
  renderTimeline();
}

function snapOffsetToBounds() {
  if (!hasSelection()) return;

  const targetOffsetY = clampOffset(viewState.offsetY, getCurrentBounds());
  if (Math.abs(targetOffsetY - viewState.offsetY) < 0.5) {
    viewState.offsetY = targetOffsetY;
    renderTimeline();
    return;
  }

  animateOffsetTo(targetOffsetY);
}

function animateOffsetTo(targetOffsetY) {
  cancelOffsetAnimation();

  const startOffsetY = viewState.offsetY;
  const startTime = performance.now();
  const durationMs = 220;

  function step(now) {
    const progress = clamp((now - startTime) / durationMs, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    viewState.offsetY = startOffsetY + (targetOffsetY - startOffsetY) * eased;
    renderTimeline();

    if (progress < 1) {
      viewState.animationFrame = requestAnimationFrame(step);
    } else {
      viewState.animationFrame = null;
    }
  }

  viewState.animationFrame = requestAnimationFrame(step);
}

function cancelOffsetAnimation() {
  if (viewState.animationFrame !== null) {
    cancelAnimationFrame(viewState.animationFrame);
    viewState.animationFrame = null;
  }
}

function getViewportY(clientY) {
  const rect = elements.timelineContainer.getBoundingClientRect();
  return clientY - rect.top;
}

function getPointerDistance(pointers) {
  const dx = pointers[0].clientX - pointers[1].clientX;
  const dy = pointers[0].clientY - pointers[1].clientY;
  return Math.hypot(dx, dy);
}

function getPointerCenterY(pointers) {
  return (pointers[0].clientY + pointers[1].clientY) / 2;
}

function trackPointer(event) {
  pointerState.pointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
    pointerType: event.pointerType,
  });
}

function getTrackedPointers() {
  return Array.from(pointerState.pointers.values());
}

function isInteractiveTarget(target) {
  return Boolean(target.closest("button, input, textarea, select, a, .timeline-toolbar, .detail-panel"));
}

function canUseHoverTooltip(event) {
  return event.pointerType === "mouse" || window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function showTooltip(event, id) {
  const item = findTimelineItem(id);
  if (!item) return;

  const duration = getItemDurationMa(item);
  elements.tooltip.innerHTML = `
    <div class="tooltip-name">${escapeHtml(item.name)}</div>
    <div class="tooltip-row">Type <span>${escapeHtml(item.type)}</span></div>
    <div class="tooltip-row">Start <span>${formatMa(item.start_ma)}</span></div>
    ${
      duration > 0
        ? `<div class="tooltip-row">End <span>${formatMa(item.end_ma)}</span></div>
           <div class="tooltip-row">Duration <span>${formatDurationMa(duration)}</span></div>`
        : ""
    }
  `;
  elements.tooltip.classList.add("visible");
  moveTooltip(event);
}

function hideTooltip() {
  elements.tooltip.classList.remove("visible");
}

function moveTooltip(event) {
  const x = event.clientX + 14;
  const y = event.clientY - 10;
  elements.tooltip.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
  elements.tooltip.style.top = `${Math.min(y, window.innerHeight - 140)}px`;
}

function bindEvents() {
  elements.brandToggle.addEventListener("click", () => {
    setChromeCollapsed(!uiState.chromeCollapsed);
  });

  elements.searchInput.addEventListener("input", () => {
    const query = elements.searchInput.value.trim();
    const results = search(query);

    autocompleteIndex = -1;
    if (!results.length || !query) {
      closeAutocomplete();
      return;
    }

    openAutocomplete(results);
  });

  elements.searchInput.addEventListener("keydown", (event) => {
    const items = elements.autocompleteList.querySelectorAll(".ac-item");

    if (event.key === "ArrowDown") {
      autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
      highlightAutocomplete(items);
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      autocompleteIndex = Math.max(autocompleteIndex - 1, -1);
      highlightAutocomplete(items);
      event.preventDefault();
    } else if (event.key === "Enter") {
      if (autocompleteIndex >= 0 && items[autocompleteIndex]) items[autocompleteIndex].click();
      else addFromInput();
      event.preventDefault();
    } else if (event.key === "Escape") {
      closeAutocomplete();
    }
  });

  elements.autocompleteList.addEventListener("click", (event) => {
    const item = event.target.closest(".ac-item");
    if (item) selectItem(item.dataset.id);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) closeAutocomplete();
  });

  elements.addButton.addEventListener("click", addFromInput);
  elements.clearButton.addEventListener("click", clearAll);

  elements.chips.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-id]");
    if (removeButton) removeItem(removeButton.dataset.removeId);
  });

  elements.presetControls.addEventListener("click", (event) => {
    const presetButton = event.target.closest("[data-preset-id]");
    if (presetButton) {
      loadPreset(presetButton.dataset.presetId);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) {
      deletePreset(deleteButton.dataset.deleteId);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      const action = actionButton.dataset.action;
      if (action === "save-preset") saveCurrentAsPreset();
      else if (action === "reset-presets") {
        if (confirm("Reset all presets to defaults? This will delete your custom presets.")) {
          resetPresets();
        }
      }
    }
  });

  elements.timelineContainer.addEventListener("click", (event) => {
    const presetButton = event.target.closest("[data-preset-id]");
    if (presetButton) {
      loadPreset(presetButton.dataset.presetId);
      return;
    }

    const viewButton = event.target.closest("[data-view-action]");
    if (viewButton) {
      handleViewAction(viewButton.dataset.viewAction);
      return;
    }

    const detailButton = event.target.closest("[data-detail-action='close']");
    if (detailButton) closeTimelineDetail();
  });

  elements.timelineContainer.addEventListener("pointerover", (event) => {
    if (!canUseHoverTooltip(event)) return;

    const itemElement = event.target.closest("[data-timeline-id]");
    if (itemElement) showTooltip(event, itemElement.dataset.timelineId);
  });

  elements.timelineContainer.addEventListener("pointerout", (event) => {
    if (!canUseHoverTooltip(event)) return;

    const itemElement = event.target.closest("[data-timeline-id]");
    if (itemElement && !itemElement.contains(event.relatedTarget)) hideTooltip();
  });

  document.addEventListener("mousemove", (event) => {
    if (elements.tooltip.classList.contains("visible")) moveTooltip(event);
  });

  elements.timelineContainer.addEventListener(
    "wheel",
    (event) => {
      if (!hasSelection()) return;

      event.preventDefault();
      if (event.ctrlKey) {
        zoomAt(getViewportY(event.clientY), clamp(Math.exp(-event.deltaY * 0.002), 0.72, 1.38));
        return;
      }

      panBy(-event.deltaY);
    },
    { passive: false },
  );

  elements.timelineContainer.addEventListener("pointerdown", beginPointerInteraction);
  elements.timelineContainer.addEventListener("pointermove", updatePointerInteraction);
  elements.timelineContainer.addEventListener("pointerup", endPointerInteraction);
  elements.timelineContainer.addEventListener("pointercancel", endPointerInteraction);

  window.addEventListener("resize", () => {
    markSelectionChanged();
    renderTimeline();
  });
}

function beginPointerInteraction(event) {
  if (!hasSelection() || isInteractiveTarget(event.target)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  event.preventDefault();
  hideTooltip();
  trackPointer(event);

  if (elements.timelineContainer.setPointerCapture) {
    elements.timelineContainer.setPointerCapture(event.pointerId);
  }

  const trackedPointers = getTrackedPointers();
  if (trackedPointers.length === 1) {
    const itemElement = event.target.closest("[data-timeline-id]");
    pointerState.primaryPointerId = event.pointerId;
    pointerState.startX = event.clientX;
    pointerState.startY = event.clientY;
    pointerState.lastY = event.clientY;
    pointerState.lastPinchDistance = null;
    pointerState.tapCandidateId = itemElement?.dataset.timelineId ?? null;
    pointerState.hasMoved = false;
    return;
  }

  if (trackedPointers.length === 2) {
    pointerState.lastPinchDistance = getPointerDistance(trackedPointers);
    pointerState.tapCandidateId = null;
    pointerState.hasMoved = true;
    elements.timelineContainer.classList.add("dragging");
  }
}

function updatePointerInteraction(event) {
  const pointer = pointerState.pointers.get(event.pointerId);
  if (!pointer) return;

  pointer.clientX = event.clientX;
  pointer.clientY = event.clientY;
  const trackedPointers = getTrackedPointers();

  if (trackedPointers.length >= 2) {
    event.preventDefault();
    const gesturePointers = trackedPointers.slice(0, 2);
    const distance = getPointerDistance(gesturePointers);

    if (pointerState.lastPinchDistance) {
      const zoomFactor = clamp(distance / pointerState.lastPinchDistance, 0.72, 1.38);
      zoomAt(getViewportY(getPointerCenterY(gesturePointers)), zoomFactor);
    }

    pointerState.lastPinchDistance = distance;
    pointerState.lastY = null;
    pointerState.hasMoved = true;
    elements.timelineContainer.classList.add("dragging");
    return;
  }

  if (pointerState.primaryPointerId !== event.pointerId || pointerState.lastY === null) return;

  const distanceFromStart = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
  if (distanceFromStart > TAP_MOVE_THRESHOLD_PX) {
    pointerState.hasMoved = true;
    pointerState.tapCandidateId = null;
    elements.timelineContainer.classList.add("dragging");
  }

  if (pointerState.hasMoved) {
    event.preventDefault();
    panBy(event.clientY - pointerState.lastY);
  }

  pointerState.lastY = event.clientY;
}

function endPointerInteraction(event) {
  if (!pointerState.pointers.has(event.pointerId)) return;

  const wasFinalPointer = pointerState.pointers.size === 1;
  const tappedItemId = wasFinalPointer && !pointerState.hasMoved ? pointerState.tapCandidateId : null;

  if (elements.timelineContainer.releasePointerCapture && elements.timelineContainer.hasPointerCapture(event.pointerId)) {
    elements.timelineContainer.releasePointerCapture(event.pointerId);
  }

  pointerState.pointers.delete(event.pointerId);

  if (!wasFinalPointer && pointerState.pointers.size === 1) {
    const [remainingPointerId, remainingPointer] = pointerState.pointers.entries().next().value;
    pointerState.primaryPointerId = remainingPointerId;
    pointerState.startX = remainingPointer.clientX;
    pointerState.startY = remainingPointer.clientY;
    pointerState.lastY = remainingPointer.clientY;
    pointerState.lastPinchDistance = null;
    pointerState.tapCandidateId = null;
    pointerState.hasMoved = true;
    return;
  }

  if (pointerState.pointers.size > 0) return;

  pointerState.primaryPointerId = null;
  pointerState.startX = null;
  pointerState.startY = null;
  pointerState.lastY = null;
  pointerState.lastPinchDistance = null;
  pointerState.tapCandidateId = null;
  pointerState.hasMoved = false;
  elements.timelineContainer.classList.remove("dragging");
  snapOffsetToBounds();

  if (tappedItemId) {
    selectTimelineDetail(tappedItemId);
  }
}

readInitialUrlState();
applyChromeState();
renderPresets();
bindEvents();
renderChips();
renderTimeline();
