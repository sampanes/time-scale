import { formatMa } from "./time-scale.js";

export const TICK_CONSTANTS = Object.freeze({
  TICKS_LONG: 5,
  TICK_RATIO: 5,
});

export const TICK_WIDTHS = Object.freeze({
  long: 60,
  medium: 35,
  short: 20,
  micro: 10,
});

const ONE_YEAR_MA = 1 / 1_000_000;
const ONE_KYA_MA = 0.001;
const MAX_TICKS_PER_LEVEL = 2000;

export const ZOOM_BOUNDS = Object.freeze({
  minPxPerMa: 1e-34,
  maxPxPerMa: 2_000_000,
});

export function niceInterval(rawInterval) {
  if (!Number.isFinite(rawInterval) || rawInterval <= 0) return 1;

  const exponent = Math.floor(Math.log10(rawInterval));
  const magnitude = 10 ** exponent;
  const fraction = rawInterval / magnitude;

  let niceFraction = 10;
  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3.5) niceFraction = 2;
  else if (fraction < 7.5) niceFraction = 5;

  return niceFraction * magnitude;
}

export function createTickPlan(pxPerMa, viewportHeight, options = {}) {
  const ticksLong = options.ticksLong ?? TICK_CONSTANTS.TICKS_LONG;
  const tickRatio = options.tickRatio ?? TICK_CONSTANTS.TICK_RATIO;
  const rawLongIntervalMa = viewportHeight / (ticksLong * pxPerMa);
  const longIntervalMa = niceInterval(rawLongIntervalMa);
  const mediumIntervalMa = longIntervalMa / tickRatio;
  const shortIntervalMa = longIntervalMa / tickRatio ** 2;
  const microIntervalMa = longIntervalMa / tickRatio ** 3;
  const longSpacingPx = longIntervalMa * pxPerMa;
  const labelFineTicks = longSpacingPx > 200;
  const minMicroIntervalMa = pxPerMa < 1_000_000 ? ONE_KYA_MA : ONE_YEAR_MA;

  const levels = [
    {
      name: "long",
      intervalMa: longIntervalMa,
      widthPct: TICK_WIDTHS.long,
      show: true,
      label: true,
    },
    {
      name: "medium",
      intervalMa: mediumIntervalMa,
      widthPct: TICK_WIDTHS.medium,
      show: pxPerMa >= 0.001,
      label: true,
    },
    {
      name: "short",
      intervalMa: shortIntervalMa,
      widthPct: TICK_WIDTHS.short,
      show: pxPerMa >= 0.1,
      label: labelFineTicks,
    },
    {
      name: "micro",
      intervalMa: microIntervalMa,
      widthPct: TICK_WIDTHS.micro,
      show: pxPerMa >= 10 && microIntervalMa >= minMicroIntervalMa,
      label: labelFineTicks,
    },
  ];

  return {
    pxPerMa,
    viewportHeight,
    rawLongIntervalMa,
    longSpacingPx,
    levels: levels.filter((level) => level.show),
  };
}

export function maToY(ma, range, pxPerMa) {
  return (range.viewMax - ma) * pxPerMa;
}

export function yToMa(y, range, pxPerMa) {
  return range.viewMax - y / pxPerMa;
}

export function getContentHeight(range, pxPerMa) {
  return Math.max(1, (range.viewMax - range.viewMin) * pxPerMa);
}

export function getOffsetBounds(contentHeight, viewportHeight) {
  if (contentHeight <= viewportHeight) {
    const centeredOffset = (viewportHeight - contentHeight) / 2;
    return { min: centeredOffset, max: centeredOffset };
  }

  const headroom = viewportHeight / 2;
  return {
    min: viewportHeight - contentHeight - headroom,
    max: headroom,
  };
}

export function clampOffset(offsetY, bounds) {
  return Math.min(bounds.max, Math.max(bounds.min, offsetY));
}

export function applyRubberDelta(offsetY, deltaY, bounds, rubberFactor = 0.2) {
  const nextOffsetY = offsetY + deltaY;

  if (nextOffsetY > bounds.max || nextOffsetY < bounds.min) {
    return offsetY + deltaY * rubberFactor;
  }

  return nextOffsetY;
}

export function zoomAroundY(options) {
  const {
    range,
    pxPerMa,
    offsetY,
    viewportY,
    viewportHeight,
    zoomFactor,
    minPxPerMa = ZOOM_BOUNDS.minPxPerMa,
    maxPxPerMa = ZOOM_BOUNDS.maxPxPerMa,
  } = options;
  const targetMa = yToMa(viewportY - offsetY, range, pxPerMa);
  const nextPxPerMa = Math.min(maxPxPerMa, Math.max(minPxPerMa, pxPerMa * zoomFactor));
  const nextOffsetY = viewportY - maToY(targetMa, range, nextPxPerMa);
  const nextContentHeight = getContentHeight(range, nextPxPerMa);

  return {
    pxPerMa: nextPxPerMa,
    offsetY: clampOffset(nextOffsetY, getOffsetBounds(nextContentHeight, viewportHeight)),
  };
}

export function makeVisibleTicks(options) {
  const { range, pxPerMa, viewportHeight, offsetY = 0, overdrawPx = viewportHeight * 0.5, referenceYear } = options;
  const contentHeight = getContentHeight(range, pxPerMa);
  const visibleTopY = Math.max(0, -offsetY - overdrawPx);
  const visibleBottomY = Math.min(contentHeight, -offsetY + viewportHeight + overdrawPx);
  const visibleMaxMa = Math.min(range.viewMax, yToMa(visibleTopY, range, pxPerMa));
  const visibleMinMa = Math.max(range.viewMin, yToMa(visibleBottomY, range, pxPerMa));
  const plan = createTickPlan(pxPerMa, viewportHeight);
  const ticks = [];
  const seenMas = [];
  const labelledYs = [];

  for (const level of plan.levels) {
    if (!Number.isFinite(level.intervalMa) || level.intervalMa <= 0) continue;

    const startIndex = Math.ceil(visibleMinMa / level.intervalMa);
    const endIndex = Math.floor((visibleMaxMa + level.intervalMa * 0.5) / level.intervalMa);
    if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) continue;
    const tickCount = endIndex - startIndex + 1;
    if (tickCount <= 0 || tickCount > MAX_TICKS_PER_LEVEL) continue;

    // Iterate via a small integer counter — accumulating into `index` directly is unsafe
    // when |startIndex| exceeds 2^53 (e.g. heat-death scale), because `index++` is a no-op.
    for (let step = 0; step < tickCount; step++) {
      const ma = (startIndex + step) * level.intervalMa;
      const normalizedMa = normalizeTickMa(ma);
      const epsilon = tickEpsilon(normalizedMa, level.intervalMa);

      if (normalizedMa < range.viewMin - epsilon || normalizedMa > range.viewMax + epsilon) continue;
      if (seenMas.some((seenMa) => Math.abs(seenMa - normalizedMa) <= epsilon)) continue;

      const y = maToY(normalizedMa, range, pxPerMa);
      const labelCollision = labelledYs.some((labelY) => Math.abs(labelY - y) < 44);
      const showLabel = level.name === "long" || (level.label && !labelCollision);

      seenMas.push(normalizedMa);
      if (showLabel) labelledYs.push(y);

      ticks.push({
        ma: normalizedMa,
        y,
        level: level.name,
        widthPct: level.widthPct,
        label: showLabel ? formatTickLabel(normalizedMa, { pxPerMa, referenceYear }) : "",
      });
    }
  }

  return ticks.sort((a, b) => a.y - b.y);
}

export function formatTickLabel(ma, options = {}) {
  const { pxPerMa = 0, referenceYear = new Date().getFullYear() } = options;

  if (pxPerMa >= 1_000_000 && Math.abs(ma) < 0.02) {
    return formatCalendarYear(ma, referenceYear);
  }

  if (ma === 0) return "";

  return formatMa(ma);
}

export function formatCalendarYear(ma, referenceYear = new Date().getFullYear()) {
  const yearsFromPresent = Math.round(ma * 1_000_000);
  const astronomicalYear = referenceYear - yearsFromPresent;

  if (astronomicalYear > 0) return `${astronomicalYear} CE`;

  return `${1 - astronomicalYear} BCE`;
}

function normalizeTickMa(ma) {
  if (Object.is(ma, -0) || Math.abs(ma) < 1e-14) return 0;
  return Number(ma.toPrecision(14));
}

function tickEpsilon(ma, intervalMa) {
  return Math.max(Math.abs(ma) * Number.EPSILON * 64, intervalMa * 1e-6, 1e-12);
}
