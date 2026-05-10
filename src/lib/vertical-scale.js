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

export function formatTickLabel(ma, options = {}) {
  const { pxPerMa = 0, referenceYear = new Date().getFullYear() } = options;

  if (pxPerMa >= 1_000_000 && Math.abs(ma) < 0.02) {
    return formatCalendarYear(ma, referenceYear);
  }

  return formatMa(ma);
}

export function formatCalendarYear(ma, referenceYear = new Date().getFullYear()) {
  const yearsFromPresent = Math.round(ma * 1_000_000);
  const astronomicalYear = referenceYear - yearsFromPresent;

  if (astronomicalYear > 0) return `${astronomicalYear} CE`;

  return `${1 - astronomicalYear} BCE`;
}

