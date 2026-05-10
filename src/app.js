import { PRESETS, TIMELINE_ITEMS, TYPE_COLORS } from "./data/timeline-data.js";
import { searchTimelineItems } from "./lib/search.js";
import { buildVerticalTimelineViewModel, getVerticalTimelineRange } from "./lib/timeline-view-model.js";
import { applyRubberDelta, clampOffset, getContentHeight, getOffsetBounds, zoomAroundY } from "./lib/vertical-scale.js";
import { formatDurationMa, formatMa, getItemDurationMa } from "./lib/time-scale.js";

let selectedItems = [];
let autocompleteIndex = -1;

const viewState = {
  pxPerMa: 1,
  offsetY: 0,
  selectionKey: "",
  animationFrame: null,
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

const elements = {
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

function renderPresets() {
  elements.presetControls.innerHTML = `
    <span class="preset-label">Try</span>
    ${PRESETS.map((preset) => `<button class="preset-btn" type="button" data-preset-id="${preset.id}">${escapeHtml(preset.label)}</button>`).join("")}
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
  markSelectionChanged();
  renderChips();
  renderTimeline();
}

function clearAll() {
  selectedItems = [];
  markSelectionChanged();
  renderChips();
  renderTimeline();
}

function loadPreset(presetId) {
  const preset = PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) return;

  selectedItems = [];

  for (const query of preset.queries) {
    const [item] = search(query);
    if (item && !selectedItems.find((selected) => selected.id === item.id)) {
      selectedItems.push(item);
    }
  }

  markSelectionChanged();
  renderChips();
  renderTimeline();
}

function markSelectionChanged() {
  viewState.selectionKey = "";
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

function renderTimeline() {
  if (!selectedItems.length) {
    elements.timelineContainer.innerHTML = `
      <div class="empty">
        <div class="empty-big">Nothing selected yet</div>
        <small>Search above or try a preset.</small>
      </div>
    `;
    return;
  }

  const viewportHeight = getTimelineViewportHeight();
  const selectionKey = selectedItems.map((item) => item.id).join("|");
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

  const ticksHtml = viewModel.ticks.map(renderTick).join("");
  const segmentsHtml = viewModel.segments.map(renderVerticalSegment).join("");
  const nowHtml =
    viewModel.nowY === null
      ? ""
      : `<div class="now-line" style="top:${viewModel.nowY}px"><span>Now</span></div>`;

  elements.timelineContainer.innerHTML = `
    <div class="timeline-readout">
      <div>
        <span>${viewModel.labels.rangeStart}</span>
        <span class="readout-arrow">to</span>
        <span>${viewModel.labels.rangeEnd}</span>
      </div>
      <div>${viewModel.labels.span} span / ${viewModel.selectedCount} selected</div>
    </div>
    <div class="timeline-stage" style="height:${viewModel.contentHeight}px;transform:translateY(${viewModel.offsetY}px);">
      <div class="ruler-column">${ticksHtml}</div>
      <div class="event-column">${segmentsHtml}${nowHtml}</div>
    </div>
  `;
}

function renderTick(tick) {
  return `
    <div class="ruler-tick ruler-tick-${tick.level}" style="top:${tick.y}px;--tick-width:${tick.widthPct}%;">
      <div class="ruler-tick-line"></div>
      ${tick.label ? `<div class="ruler-tick-label">${escapeHtml(tick.label)}</div>` : ""}
    </div>
  `;
}

function renderVerticalSegment(segment) {
  const colorStyle = `--item-color:${segment.color};`;

  if (segment.isPoint) {
    return `
      <div class="event-point" style="top:${segment.y}px;z-index:${segment.zIndex};${colorStyle}" data-timeline-id="${segment.id}">
        <div class="event-point-line"></div>
        <div class="event-point-label">${escapeHtml(segment.name)}</div>
      </div>
    `;
  }

  const compactClass = segment.height < 34 ? " compact" : "";

  return `
    <div
      class="event-segment${compactClass}"
      style="top:${segment.top}px;height:${Math.max(segment.height, 2)}px;z-index:${segment.zIndex};${colorStyle}"
      data-timeline-id="${segment.id}"
    >
      <span class="event-segment-label">${escapeHtml(segment.name)}</span>
    </div>
  `;
}

function getTimelineViewportHeight() {
  return Math.max(320, elements.timelineContainer.clientHeight || Math.floor(window.innerHeight * 0.68));
}

function fitSelectionToViewport(range, viewportHeight) {
  const spanMa = Math.max(range.viewMax - range.viewMin, 1e-9);
  const targetHeight = viewportHeight * 0.86;
  viewState.pxPerMa = clamp(targetHeight / spanMa, 0.00005, 2_000_000);
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
  return Boolean(target.closest("button, input, textarea, select, a"));
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
    if (presetButton) loadPreset(presetButton.dataset.presetId);
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
}

renderPresets();
bindEvents();
renderChips();
renderTimeline();
