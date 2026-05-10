import { PRESETS, TIMELINE_ITEMS, TYPE_COLORS } from "./data/timeline-data.js";
import { searchTimelineItems } from "./lib/search.js";
import { buildTimelineViewModel } from "./lib/timeline-view-model.js";
import { formatDurationMa, formatMa, getItemDurationMa } from "./lib/time-scale.js";

let selectedItems = [];
let autocompleteIndex = -1;

const elements = {
  searchInput: document.getElementById("searchInput"),
  autocompleteList: document.getElementById("acList"),
  chips: document.getElementById("chips"),
  logToggle: document.getElementById("logToggle"),
  logWarning: document.getElementById("logWarning"),
  timelineContainer: document.getElementById("timelineContainer"),
  emptyState: document.getElementById("emptyState"),
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
    <span class="preset-label">Try:</span>
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
  renderChips();
  renderTimeline();
}

function clearAll() {
  selectedItems = [];
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

  renderChips();
  renderTimeline();
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
  elements.logWarning.classList.toggle("show", elements.logToggle.checked);

  if (!selectedItems.length) {
    elements.emptyState.style.display = "block";
    elements.timelineContainer.innerHTML = "";
    elements.timelineContainer.appendChild(elements.emptyState);
    return;
  }

  const viewModel = buildTimelineViewModel(selectedItems, {
    isLog: elements.logToggle.checked,
    typeColors: TYPE_COLORS,
  });

  const segmentsHtml = viewModel.segments.map(renderSegment).join("");
  const nowHtml =
    viewModel.nowPct === null
      ? ""
      : `<div class="now-line" style="left:${viewModel.nowPct}%"><div class="now-label">Now</div></div>`;
  const ticksHtml = viewModel.ticks
    .map(
      (tick) => `
        <div class="tick" style="left:${tick.pct}%">
          <div class="tick-line"></div>
          <div class="tick-label">${formatMa(tick.ma)}</div>
        </div>
      `,
    )
    .join("");

  elements.timelineContainer.innerHTML = `
    <div class="timeline-header">
      <div class="range-label">
        <span>${viewModel.labels.rangeStart}</span> -> <span>${viewModel.labels.rangeEnd}</span>
        &nbsp;.&nbsp; span: <span>${viewModel.labels.span}</span>
      </div>
      <div class="range-label">${viewModel.selectedCount} item${viewModel.selectedCount !== 1 ? "s" : ""} selected</div>
    </div>
    <div class="track-wrap">
      <div class="track">${segmentsHtml}${nowHtml}</div>
      <div class="tick-row">${ticksHtml}</div>
    </div>
  `;
}

function renderSegment(segment) {
  if (segment.isPoint) {
    return `
      <div
        class="segment"
        style="left:${segment.left}%;width:2px;background:${segment.color};top:4px;height:52px;border-right:none;"
        data-id="${segment.id}"
      ></div>
      <div class="point-label" style="left:${segment.left}%;color:${segment.color};">${escapeHtml(segment.name)}</div>
    `;
  }

  return `
    <div class="segment" style="left:${segment.left}%;width:${segment.width}%;background:${segment.color};" data-id="${segment.id}">
      <span class="segment-label">${segment.width > 3 ? escapeHtml(segment.name) : ""}</span>
    </div>
  `;
}

function showTooltip(event, id) {
  const item = findTimelineItem(id);
  if (!item) return;

  const duration = getItemDurationMa(item);
  elements.tooltip.innerHTML = `
    <div class="tooltip-name">${escapeHtml(item.name)}</div>
    <div class="tooltip-row">Type: <span>${escapeHtml(item.type)}</span></div>
    <div class="tooltip-row">Start: <span>${formatMa(item.start_ma)}</span></div>
    ${
      duration > 0
        ? `<div class="tooltip-row">End: <span>${formatMa(item.end_ma)}</span></div>
           <div class="tooltip-row">Duration: <span>${formatDurationMa(duration)}</span></div>`
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
  elements.tooltip.style.left = `${Math.min(x, window.innerWidth - 240)}px`;
  elements.tooltip.style.top = `${Math.min(y, window.innerHeight - 120)}px`;
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
  elements.logToggle.addEventListener("change", renderTimeline);

  elements.chips.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-id]");
    if (removeButton) removeItem(removeButton.dataset.removeId);
  });

  elements.presetControls.addEventListener("click", (event) => {
    const presetButton = event.target.closest("[data-preset-id]");
    if (presetButton) loadPreset(presetButton.dataset.presetId);
  });

  elements.timelineContainer.addEventListener("pointerover", (event) => {
    const segment = event.target.closest(".segment");
    if (segment) showTooltip(event, segment.dataset.id);
  });

  elements.timelineContainer.addEventListener("pointerout", (event) => {
    const segment = event.target.closest(".segment");
    if (segment && !segment.contains(event.relatedTarget)) hideTooltip();
  });

  document.addEventListener("mousemove", (event) => {
    if (elements.tooltip.classList.contains("visible")) moveTooltip(event);
  });
}

renderPresets();
bindEvents();
renderChips();
renderTimeline();
