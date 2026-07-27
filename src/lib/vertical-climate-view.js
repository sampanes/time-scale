import { CLIMATE_VIEWS } from "../data/climate-data.js";
import { CLIMATE_METRICS } from "../data/climate-metrics.js";
import { maToY } from "./vertical-scale.js";

const INDUSTRIAL_START_MA = (2026 - 1850) / 1_000_000;
const ICE_CORE_START_MA = 0.8;

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
  if (range.viewMax > ICE_CORE_START_MA) series.push({ id: "proxy", points: deep.co2.map((point) => ({ ...point, ma: toMa(deep, point.x) })).filter((point) => point.ma >= ICE_CORE_START_MA) });
  if (range.viewMin < ICE_CORE_START_MA && range.viewMax > INDUSTRIAL_START_MA) series.push({ id: "ice", points: ice.co2.map((point) => ({ ...point, ma: toMa(ice, point.x) })).filter((point) => point.ma >= INDUSTRIAL_START_MA) });
  if (range.viewMin < INDUSTRIAL_START_MA) series.push({ id: "modern", points: modern.co2.map((point) => ({ ...point, ma: toMa(modern, point.x) })) });
  return series.filter((item) => item.points.length);
}

function choosePpmMax(range) {
  if (range.viewMax <= 1) return 500;
  if (range.viewMax <= 60) return 2500;
  return 5000;
}

function pathForPoints(points, range, pxPerMa, offsetY, max) {
  return points.map((point, index) => {
    const x = (point.value / max) * 1000;
    const y = maToY(point.ma, range, pxPerMa) + offsetY;
    return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function areaForPoints(points, range, pxPerMa, offsetY, max) {
  if (!points.length) return "";
  const line = pathForPoints(points, range, pxPerMa, offsetY, max);
  const firstY = maToY(points[0].ma, range, pxPerMa) + offsetY;
  const lastY = maToY(points.at(-1).ma, range, pxPerMa) + offsetY;
  return `M 0 ${firstY.toFixed(2)} ${line} L 0 ${lastY.toFixed(2)} Z`;
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
    return { ...metric, max, scaleLabel: `0–${max.toLocaleString()} ppm`, series };
  }

  const points = metric.points.map(([year, value]) => ({ year, value, ma: (2026 - year) / 1_000_000 }));
  return {
    ...metric,
    scaleLabel: `0–${metric.max.toLocaleString()} ${metric.unit}`,
    series: [{ id: metric.id, points, linePath: pathForPoints(points, range, pxPerMa, offsetY, metric.max), areaPath: areaForPoints(points, range, pxPerMa, offsetY, metric.max), uncertainty: [] }],
  };
}

export function buildVerticalClimateViewModel({ range, pxPerMa, offsetY, activeMetricIds = ["co2"] }) {
  const tracks = activeMetricIds.map((id) => CLIMATE_METRICS.find((metric) => metric.id === id)).filter(Boolean).map((metric) => buildTrack(metric, range, pxPerMa, offsetY));
  return { tracks };
}

export function renderVerticalClimateLane(model, viewportHeight) {
  if (!model.tracks.length) return `<aside class="climate-column climate-column-empty" aria-label="Climate metrics"><div class="vertical-climate-empty">Select a climate metric above</div></aside>`;
  const paths = model.tracks.flatMap((track) => track.series.map((series) => `
    <g class="vertical-climate-series vertical-climate-${series.id}" style="--track-color:${track.color}">
      <path class="vertical-climate-area" d="${series.areaPath}"/>
      <path class="vertical-climate-line" d="${series.linePath}"/>
      ${series.uncertainty.map((point) => `<line class="vertical-climate-uncertainty" x1="${point.lowPct * 10}" x2="${point.highPct * 10}" y1="${point.y}" y2="${point.y}"/>`).join("")}
    </g>`)).join("");
  const sources = [...new Map(model.tracks.map((track) => [track.sourceUrl, track])).values()];
  const heading = model.tracks.length === 1 ? `<strong>${model.tracks[0].label}</strong><span>${model.tracks[0].scaleLabel}</span>` : `<strong>${model.tracks.length} climate signals</strong><span>Each uses its labeled scale</span>`;
  return `
    <aside class="climate-column" aria-label="Selected climate metrics aligned to the timeline">
      <div class="vertical-climate-heading">${heading}</div>
      <svg viewBox="0 0 1000 ${viewportHeight}" preserveAspectRatio="none" aria-hidden="true"><line class="vertical-climate-midline" x1="500" x2="500" y1="0" y2="${viewportHeight}"/>${paths}</svg>
      <div class="vertical-climate-legend">${model.tracks.map((track) => `<span style="--track-color:${track.color}" title="${track.note || track.scaleLabel}">${track.shortLabel} · ${track.unit}</span>`).join("")}</div>
      <div class="vertical-climate-sources">${sources.map((source) => `<a href="${source.sourceUrl}" target="_blank" rel="noreferrer">${source.sourceLabel}</a>`).join("")}</div>
    </aside>`;
}
