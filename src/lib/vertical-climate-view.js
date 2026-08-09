import { CLIMATE_VIEWS } from "../data/climate-data.js";
import { CLIMATE_METRICS } from "../data/climate-metrics.js";
import { maToY } from "./vertical-scale.js";

const INDUSTRIAL_START_MA = (2026 - 1850) / 1_000_000;
const ICE_CORE_START_MA = 0.8;
const MIN_LITERAL_RECORD_HEIGHT_PX = 96;

function toMa(view, x) {
  if (view.id === "industrial") return (2026 - x) / 1_000_000;
  if (view.id === "ice-ages") return x / 1000;
  return x;
}

function co2SeriesForRange(range) {
  const deep = CLIMATE_VIEWS.find((view) => view.id === "deep-time");
  const ice = CLIMATE_VIEWS.find((view) => view.id === "ice-ages");
  const modern = CLIMATE_VIEWS.find((view) => view.id === "industrial");
  const series = [];
  if (range.viewMax > ICE_CORE_START_MA) series.push({ id: "proxy", label: "Deep-time proxy", points: deep.co2.map((point) => ({ ...point, ma: toMa(deep, point.x) })).filter((point) => point.ma >= ICE_CORE_START_MA) });
  if (range.viewMin < ICE_CORE_START_MA && range.viewMax > INDUSTRIAL_START_MA) series.push({ id: "ice", label: "Ice core", points: ice.co2.map((point) => ({ ...point, ma: toMa(ice, point.x) })).filter((point) => point.ma >= INDUSTRIAL_START_MA) });
  if (range.viewMin < INDUSTRIAL_START_MA) series.push({ id: "modern", label: "Direct + assessed", points: modern.co2.map((point) => ({ ...point, ma: toMa(modern, point.x) })) });
  return series.filter((item) => item.points.length);
}

function choosePpmMax(range) {
  if (range.viewMax <= 1) return 500;
  if (range.viewMax <= 60) return 2500;
  return 5000;
}

function coordinates(points, range, pxPerMa, offsetY, max) {
  return points.map((point) => ({ x: (point.value / max) * 1000, y: maToY(point.ma, range, pxPerMa) + offsetY }));
}

function pathForPoints(points, range, pxPerMa, offsetY, max) {
  return coordinates(points, range, pxPerMa, offsetY, max).map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function areaForPoints(points, range, pxPerMa, offsetY, max) {
  const mapped = coordinates(points, range, pxPerMa, offsetY, max);
  if (!mapped.length) return "";
  const line = mapped.map((point, index) => `${index ? "L" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  return `M 0 ${mapped[0].y.toFixed(2)} ${line} L 0 ${mapped.at(-1).y.toFixed(2)} Z`;
}

function modernCo2Points() {
  const modern = CLIMATE_VIEWS.find((view) => view.id === "industrial");
  return modern.co2.map((point) => ({ ...point, year: point.x, ma: toMa(modern, point.x) }));
}

function buildTrack(metric, range, pxPerMa, offsetY) {
  if (metric.id === "co2") {
    const max = choosePpmMax(range);
    const series = co2SeriesForRange(range).map((item) => ({
      ...item,
      linePath: pathForPoints(item.points, range, pxPerMa, offsetY, max),
      areaPath: areaForPoints(item.points, range, pxPerMa, offsetY, max),
      uncertainty: item.points.filter((point) => Number.isFinite(point.low) && Number.isFinite(point.high)).map((point) => ({ y: maToY(point.ma, range, pxPerMa) + offsetY, lowPct: (point.low / max) * 100, highPct: (point.high / max) * 100 })),
    }));
    return { ...metric, max, scaleLabel: `0–${max.toLocaleString()} ppm`, series, focusPoints: modernCo2Points() };
  }

  const points = metric.points.map(([year, value]) => ({ year, value, ma: (2026 - year) / 1_000_000 }));
  return { ...metric, scaleLabel: `0–${metric.max.toLocaleString()} ${metric.unit}`, series: [{ id: metric.id, label: metric.shortLabel, points, linePath: pathForPoints(points, range, pxPerMa, offsetY, metric.max), areaPath: areaForPoints(points, range, pxPerMa, offsetY, metric.max), uncertainty: [] }], focusPoints: points };
}

function buildLens(track, range, pxPerMa) {
  if (!track?.focusPoints?.length || track.focusPoints.length < 2) return null;
  const oldestMa = Math.max(...track.focusPoints.map((point) => point.ma));
  const newestMa = Math.min(...track.focusPoints.map((point) => point.ma));
  const literalHeight = (oldestMa - newestMa) * pxPerMa;
  const overlapsRange = range.viewMin <= oldestMa && range.viewMax >= newestMa;
  if (!overlapsRange || literalHeight >= MIN_LITERAL_RECORD_HEIGHT_PX) return null;
  const span = Math.max(oldestMa - newestMa, 1e-12);
  const path = track.focusPoints.map((point, index) => {
    const x = (point.value / track.max) * 1000;
    const y = ((oldestMa - point.ma) / span) * 1000;
    return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return { path, oldestYear: Math.min(...track.focusPoints.map((point) => point.year)), newestYear: Math.max(...track.focusPoints.map((point) => point.year)), literalHeight };
}

export function buildVerticalClimateViewModel({ range, pxPerMa, offsetY, focusedMetricId = "co2" }) {
  const metric = CLIMATE_METRICS.find((candidate) => candidate.id === focusedMetricId) ?? null;
  const track = metric ? buildTrack(metric, range, pxPerMa, offsetY) : null;
  return { track, lens: buildLens(track, range, pxPerMa) };
}

function renderSeries(track) {
  return track.series.map((series) => `
    <g class="vertical-climate-series vertical-climate-${series.id}" style="--track-color:${track.color}">
      <path class="vertical-climate-area" d="${series.areaPath}"/>
      <path class="vertical-climate-line" d="${series.linePath}"/>
      ${series.uncertainty.map((point) => `<line class="vertical-climate-uncertainty" x1="${point.lowPct * 10}" x2="${point.highPct * 10}" y1="${point.y}" y2="${point.y}"/>`).join("")}
    </g>`).join("");
}

function renderLens(track, lens) {
  if (!lens) return "";
  return `<section class="climate-lens" style="--track-color:${track.color}" aria-label="Magnified ${track.label} record">
    <div class="climate-lens-heading"><strong>Magnified record</strong><span>Not to timeline scale</span></div>
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><line x1="500" x2="500" y1="0" y2="1000"/><path d="${lens.path}"/></svg>
    <span class="climate-lens-year oldest">${lens.oldestYear}</span><span class="climate-lens-year newest">${lens.newestYear}</span>
  </section>`;
}

export function renderVerticalClimateLane(model, viewportHeight) {
  if (!model.track) return `<aside class="climate-column climate-column-empty" aria-label="Climate metrics"><div class="vertical-climate-empty">Select a climate track above</div></aside>`;
  const track = model.track;
  const evidenceLegend = track.series.length > 1 ? `<div class="vertical-climate-evidence">${track.series.map((series) => `<span class="${series.id}">${series.label}</span>`).join("")}</div>` : "";
  return `
    <aside class="climate-column" aria-label="${track.label} aligned to the timeline">
      <div class="vertical-climate-heading"><strong>${track.label}</strong><span>${track.scaleLabel}</span></div>
      <div class="vertical-climate-scale"><span>0</span><span>${(track.max / 2).toLocaleString()}</span><span>${track.max.toLocaleString()}</span></div>
      <svg class="climate-literal-chart" viewBox="0 0 1000 ${viewportHeight}" preserveAspectRatio="none" aria-hidden="true"><line class="vertical-climate-midline" x1="500" x2="500" y1="0" y2="${viewportHeight}"/>${renderSeries(track)}</svg>
      ${renderLens(track, model.lens)}
      ${evidenceLegend}
      <div class="vertical-climate-note">${track.note || "Width is atmospheric concentration; vertical position uses the shared timeline."}</div>
      <div class="vertical-climate-sources"><a href="${track.sourceUrl}" target="_blank" rel="noreferrer">Source: ${track.sourceLabel}</a></div>
    </aside>`;
}
