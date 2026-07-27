import { CLIMATE_VIEWS } from "../data/climate-data.js";
import { maToY } from "./vertical-scale.js";

const INDUSTRIAL_START_MA = (2026 - 1850) / 1_000_000;
const ICE_CORE_START_MA = 0.8;

function toMa(view, x) {
  if (view.id === "industrial") return (2026 - x) / 1_000_000;
  if (view.id === "ice-ages") return x / 1000;
  return x;
}

function seriesForRange(range) {
  const deep = CLIMATE_VIEWS.find((view) => view.id === "deep-time");
  const ice = CLIMATE_VIEWS.find((view) => view.id === "ice-ages");
  const modern = CLIMATE_VIEWS.find((view) => view.id === "industrial");
  const series = [];

  if (range.viewMax > ICE_CORE_START_MA) {
    series.push({
      id: "proxy",
      label: "Deep-time proxies",
      points: deep.co2.map((point) => ({ ...point, ma: toMa(deep, point.x) })).filter((point) => point.ma >= ICE_CORE_START_MA),
    });
  }

  if (range.viewMin < ICE_CORE_START_MA && range.viewMax > INDUSTRIAL_START_MA) {
    series.push({
      id: "ice",
      label: "Ice cores",
      points: ice.co2.map((point) => ({ ...point, ma: toMa(ice, point.x) })).filter((point) => point.ma >= INDUSTRIAL_START_MA),
    });
  }

  if (range.viewMin < INDUSTRIAL_START_MA) {
    series.push({
      id: "modern",
      label: "Direct + assessed",
      points: modern.co2.map((point) => ({ ...point, ma: toMa(modern, point.x) })),
    });
  }

  return series.filter((item) => item.points.length);
}

function choosePpmMax(range) {
  if (range.viewMax <= 1) return 500;
  if (range.viewMax <= 60) return 2500;
  return 5000;
}

function pathForPoints(points, range, pxPerMa, offsetY, ppmMax) {
  return points.map((point, index) => {
    const x = (point.value / ppmMax) * 1000;
    const y = maToY(point.ma, range, pxPerMa) + offsetY;
    return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function areaForPoints(points, range, pxPerMa, offsetY, ppmMax) {
  if (!points.length) return "";
  const line = pathForPoints(points, range, pxPerMa, offsetY, ppmMax);
  const firstY = maToY(points[0].ma, range, pxPerMa) + offsetY;
  const lastY = maToY(points.at(-1).ma, range, pxPerMa) + offsetY;
  return `M 0 ${firstY.toFixed(2)} ${line} L 0 ${lastY.toFixed(2)} Z`;
}

export function buildVerticalClimateViewModel({ range, pxPerMa, offsetY }) {
  const ppmMax = choosePpmMax(range);
  const series = seriesForRange(range).map((item) => ({
    ...item,
    linePath: pathForPoints(item.points, range, pxPerMa, offsetY, ppmMax),
    areaPath: areaForPoints(item.points, range, pxPerMa, offsetY, ppmMax),
    uncertainty: item.points
      .filter((point) => Number.isFinite(point.low) && Number.isFinite(point.high))
      .map((point) => ({
        y: maToY(point.ma, range, pxPerMa) + offsetY,
        lowPct: (point.low / ppmMax) * 100,
        highPct: (point.high / ppmMax) * 100,
      })),
  }));

  return { ppmMax, series };
}

export function renderVerticalClimateLane(model, viewportHeight) {
  const paths = model.series.map((series) => `
    <g class="vertical-climate-series vertical-climate-${series.id}">
      <path class="vertical-climate-area" d="${series.areaPath}"/>
      <path class="vertical-climate-line" d="${series.linePath}"/>
      ${series.uncertainty.map((point) => `<line class="vertical-climate-uncertainty" x1="${point.lowPct * 10}" x2="${point.highPct * 10}" y1="${point.y}" y2="${point.y}"/>`).join("")}
    </g>`).join("");

  return `
    <aside class="climate-column" aria-label="Atmospheric carbon dioxide aligned to the timeline">
      <div class="vertical-climate-heading">
        <strong>Atmospheric CO₂</strong>
        <span>0–${model.ppmMax.toLocaleString()} ppm</span>
      </div>
      <div class="vertical-climate-scale"><span>0</span><span>${Math.round(model.ppmMax / 2).toLocaleString()}</span><span>${model.ppmMax.toLocaleString()}</span></div>
      <svg viewBox="0 0 1000 ${viewportHeight}" preserveAspectRatio="none" aria-hidden="true">
        <line class="vertical-climate-midline" x1="500" x2="500" y1="0" y2="${viewportHeight}"/>
        ${paths}
      </svg>
      <div class="vertical-climate-legend">
        ${model.series.map((series) => `<span class="${series.id}">${series.label}</span>`).join("")}
      </div>
      <div class="vertical-climate-sources"><a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noreferrer">NOAA GML</a><a href="https://www.ncei.noaa.gov/products/paleoclimatology/ice-core" target="_blank" rel="noreferrer">NOAA ice cores</a><a href="https://www.ipcc.ch/report/ar6/wg1/" target="_blank" rel="noreferrer">IPCC AR6</a></div>
    </aside>`;
}
