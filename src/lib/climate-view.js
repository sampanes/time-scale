import { CLIMATE_INDICATORS, CLIMATE_SOURCES, CLIMATE_VIEWS } from "../data/climate-data.js";

const SVG_W = 1000;
const SVG_H = 520;
const PAD = { top: 54, right: 34, bottom: 62, left: 76 };

export function getClimateView(id) {
  return CLIMATE_VIEWS.find((view) => view.id === id) ?? CLIMATE_VIEWS[0];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sx(view, x) {
  const [a, b] = view.domain;
  return PAD.left + ((x - a) / (b - a)) * (SVG_W - PAD.left - PAD.right);
}

function sy(view, value) {
  const plotHeight = SVG_H - PAD.top - PAD.bottom;
  return PAD.top + (1 - clamp(value / view.co2Max, 0, 1)) * plotHeight;
}

function linePath(view) {
  return view.co2.map((point, index) => `${index ? "L" : "M"} ${sx(view, point.x).toFixed(1)} ${sy(view, point.value).toFixed(1)}`).join(" ");
}

function areaPath(view) {
  const bottom = sy(view, 0);
  const first = view.co2[0];
  const last = view.co2.at(-1);
  return `M ${sx(view, first.x)} ${bottom} ${linePath(view)} L ${sx(view, last.x)} ${bottom} Z`;
}

function uncertaintyPath(view) {
  const ranged = view.co2.filter((point) => Number.isFinite(point.low) && Number.isFinite(point.high));
  if (ranged.length < 2) return "";
  const top = ranged.map((point, index) => `${index ? "L" : "M"} ${sx(view, point.x)} ${sy(view, point.high)}`).join(" ");
  const bottom = ranged.slice().reverse().map((point) => `L ${sx(view, point.x)} ${sy(view, point.low)}`).join(" ");
  return `${top} ${bottom} Z`;
}

function formatPpm(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : String(Math.round(value));
}

function climateXForTimelineItem(view, item) {
  if (view.id === "industrial") return 2026 - item.start_ma * 1_000_000;
  if (view.id === "ice-ages") return item.start_ma * 1000;
  return item.start_ma;
}

function timelineItemIsVisible(view, item) {
  const x = climateXForTimelineItem(view, item);
  const [a, b] = view.domain;
  return x >= Math.min(a, b) && x <= Math.max(a, b);
}

function formatTimelineItemDate(item) {
  const yearsAgo = item.start_ma * 1_000_000;
  if (yearsAgo >= 1_000_000) return `${(yearsAgo / 1_000_000).toFixed(1)} Ma`;
  if (yearsAgo >= 10_000) return `${Math.round(yearsAgo / 1000)} ka`;
  if (yearsAgo >= 2026) return `${Math.max(1, Math.round(yearsAgo - 2026))} BCE`;
  return `${Math.max(1, Math.round(2026 - yearsAgo))} CE`;
}

export function renderClimateChart(view, layers, timelineItems = []) {
  const gridValues = view.co2Max > 1000 ? [0, 1000, 2000, 3000, 4000, 5000] : [0, 100, 200, 300, 400];
  const grid = gridValues
    .filter((value) => value <= view.co2Max)
    .map((value) => {
      const y = sy(view, value);
      return `<g class="climate-grid"><line x1="${PAD.left}" y1="${y}" x2="${SVG_W - PAD.right}" y2="${y}"/><text x="${PAD.left - 14}" y="${y + 5}">${formatPpm(value)}</text></g>`;
    })
    .join("");

  const context = layers.context
    ? view.context.map((item, index) => {
        const left = sx(view, item.start);
        const right = sx(view, item.end);
        const x = Math.min(left, right);
        const width = Math.max(3, Math.abs(right - left));
        return `<g class="climate-context context-${index % 3}"><rect x="${x}" y="${PAD.top + index * 24}" width="${width}" height="18" rx="4"/><text x="${x + 6}" y="${PAD.top + 13 + index * 24}">${item.label}</text></g>`;
      }).join("")
    : "";

  const uncertainty = layers.uncertainty && view.connectPoints !== false && uncertaintyPath(view)
    ? `<path class="climate-uncertainty" d="${uncertaintyPath(view)}"/>`
    : "";

  const assessedPoints = view.connectPoints === false
    ? view.co2.map((point) => {
        const x = sx(view, point.x);
        const y = sy(view, point.value);
        const whisker = layers.uncertainty && Number.isFinite(point.low) && Number.isFinite(point.high)
          ? `<line class="climate-whisker" x1="${x}" y1="${sy(view, point.high)}" x2="${x}" y2="${sy(view, point.low)}"/>
             <line class="climate-whisker-cap" x1="${x - 10}" y1="${sy(view, point.high)}" x2="${x + 10}" y2="${sy(view, point.high)}"/>
             <line class="climate-whisker-cap" x1="${x - 10}" y1="${sy(view, point.low)}" x2="${x + 10}" y2="${sy(view, point.low)}"/>`
          : "";
        return `<g class="climate-assessed-point">${whisker}<circle cx="${x}" cy="${y}" r="8"/></g>`;
      }).join("")
    : "";

  const callouts = layers.callouts
    ? view.callouts.map((item, index) => {
        const x = sx(view, item.x);
        const y = sy(view, item.value);
        const anchor = x > SVG_W * 0.72 ? "end" : "start";
        const dx = anchor === "end" ? -12 : 12;
        const dy = index % 2 ? 34 : -18;
        return `<g class="climate-callout"><circle cx="${x}" cy="${y}" r="6"/><line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y + dy - 5}"/><text text-anchor="${anchor}" x="${x + dx}" y="${y + dy}">${item.label}</text></g>`;
      }).join("")
    : "";

  const timelineMarkers = timelineItems
    .filter((item) => timelineItemIsVisible(view, item))
    .map((item, index) => {
      const x = sx(view, climateXForTimelineItem(view, item));
      return `<g class="climate-event-marker">
        <line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${SVG_H - PAD.bottom}"/>
        <circle cx="${x}" cy="${SVG_H - PAD.bottom}" r="10"/>
        <text text-anchor="middle" x="${x}" y="${SVG_H - PAD.bottom + 4}">${index + 1}</text>
      </g>`;
    })
    .join("");

  const xLabels = view.xLabels.map((label, index) => {
    const x = PAD.left + (index / (view.xLabels.length - 1)) * (SVG_W - PAD.left - PAD.right);
    return `<text class="climate-x-label" text-anchor="${index === 0 ? "start" : index === view.xLabels.length - 1 ? "end" : "middle"}" x="${x}" y="${SVG_H - 24}">${label}</text>`;
  }).join("");

  return `
    <svg class="climate-chart" viewBox="0 0 ${SVG_W} ${SVG_H}" role="img" aria-labelledby="climateChartTitle climateChartDesc">
      <title id="climateChartTitle">${view.title}</title>
      <desc id="climateChartDesc">Atmospheric carbon dioxide in parts per million across ${view.rangeLabel}.</desc>
      ${grid}
      <text class="climate-axis-title" x="20" y="${SVG_H / 2}" transform="rotate(-90 20 ${SVG_H / 2})">Atmospheric CO₂ (ppm)</text>
      ${context}
      ${uncertainty}
      ${view.connectPoints === false ? "" : `<path class="climate-area" d="${areaPath(view)}"/><path class="climate-line" d="${linePath(view)}"/>`}
      ${assessedPoints}
      ${callouts}
      ${timelineMarkers}
      ${xLabels}
    </svg>
  `;
}

export function renderClimateExperience(state) {
  const view = getClimateView(state.viewId);
  const timelineItems = state.contextItems ?? [];
  const visibleTimelineItems = timelineItems.filter((item) => timelineItemIsVisible(view, item));
  const overlayLegend = visibleTimelineItems.length
    ? `<ol class="climate-overlay-legend" aria-label="Visible timeline overlay legend">${visibleTimelineItems.map((item) => `<li><span>${visibleTimelineItems.indexOf(item) + 1}</span><strong>${item.name}</strong><small>${formatTimelineItemDate(item)}</small></li>`).join("")}</ol>`
    : "";
  const indicators = state.layers.indicators
    ? `<section class="climate-indicators" aria-label="Observed climate indicators">${CLIMATE_INDICATORS.map((indicator) => `
        <article class="climate-indicator">
          <strong>${indicator.value}</strong>
          <span>${indicator.label}</span>
          <small>${indicator.detail}</small>
        </article>`).join("")}</section>`
    : "";
  const sources = state.layers.sources
    ? `<details class="climate-sources" open><summary>Sources &amp; reading notes</summary>
        <div>${view.sources.map((id) => {
          const source = CLIMATE_SOURCES[id];
          return `<p><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a><span>${source.note}</span></p>`;
        }).join("")}</div>
      </details>`
    : "";

  return `
    <div class="climate-experience">
      <section class="climate-hero">
        <div>
          <span class="climate-eyebrow">Climate lens · ${view.kicker}</span>
          <h2>${view.title}</h2>
          <p>${view.description}</p>
        </div>
        <div class="climate-current"><strong>427.83</strong><span>ppm CO₂</span><small>NOAA global estimate · Jul 25, 2026</small></div>
      </section>
      <nav class="climate-views" aria-label="Climate timescale">
        ${CLIMATE_VIEWS.map((item) => `<button type="button" class="${item.id === view.id ? "active" : ""}" data-climate-view="${item.id}" aria-pressed="${item.id === view.id}"><span>${item.label}</span><small>${item.kicker}</small></button>`).join("")}
      </nav>
      <section class="climate-layer-panel" aria-label="Visible climate layers">
        <span>Show</span>
        ${Object.entries({ context: "Life context", callouts: "Annotations", uncertainty: "Uncertainty", indicators: "Impacts", sources: "Sources" }).map(([id, label]) => `
          <label><input type="checkbox" data-climate-layer="${id}" ${state.layers[id] ? "checked" : ""}><span>${label}</span></label>`).join("")}
      </section>
      <section class="climate-event-picker" aria-label="Timeline overlays">
        <div class="climate-event-heading">
          <div><span>Timeline overlays</span><strong>Place any event on the climate record</strong></div>
          <small>${visibleTimelineItems.length} of ${timelineItems.length} selected items visible in this range</small>
        </div>
        <div class="climate-event-search">
          <input type="search" data-climate-event-search placeholder="Search people, species, eras, events…" autocomplete="off" aria-label="Search timeline overlays">
          <div class="climate-event-results" aria-live="polite"></div>
        </div>
        <div class="climate-event-chips">
          ${timelineItems.length
            ? timelineItems.map((item) => `<button type="button" data-remove-climate-event="${item.id}" class="${timelineItemIsVisible(view, item) ? "" : "outside-range"}" title="${timelineItemIsVisible(view, item) ? "Visible in this view" : "Outside this view"}">${item.name}<span>×</span></button>`).join("")
            : `<span>Try “Jesus”, “first hominins”, “agriculture”, or any existing timeline entry.</span>`}
        </div>
      </section>
      <section class="climate-figure">
        <header>
          <div><span>${view.rangeLabel}</span><strong>CO₂ concentration over time</strong></div>
          <div class="climate-figure-actions">
            <small>Vertical scale changes between views; values remain labeled in ppm.</small>
            <div>
              <button type="button" data-climate-export="svg">Chart SVG</button>
              <button type="button" data-climate-export="html">Full view HTML</button>
            </div>
          </div>
        </header>
        <div class="climate-chart-scroll">${renderClimateChart(view, state.layers, timelineItems)}</div>
        ${overlayLegend}
        <p class="climate-takeaway">${view.takeaway}</p>
      </section>
      ${indicators}
      ${sources}
      <p class="climate-method">This demonstrator uses sparse assessed anchors for clarity. Deep-time values are proxy ranges, not instrument-like measurements; connecting lines guide the eye and do not invent precision between samples.</p>
    </div>
  `;
}
