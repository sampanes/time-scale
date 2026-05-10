export const SCALE_MODES = Object.freeze({
  LINEAR: "linear",
  LOG: "log",
});

export function formatMa(ma) {
  if (ma === 0) return "Now";

  if (ma < 0) {
    const abs = Math.abs(ma);
    if (abs >= 1e9) return `+${abs.toExponential(2)} Ma future`;
    if (abs >= 1000) return `+${(abs / 1000).toFixed(1)} Ga future`;
    return `+${abs.toFixed(1)} Ma future`;
  }

  if (ma < 0.001) return `${(ma * 1000000).toFixed(0)} yrs ago`;
  if (ma < 1) return `${(ma * 1000).toFixed(0)} kya`;
  if (ma >= 1e9) return `${ma.toExponential(2)} Ma ago`;
  if (ma >= 1000) return `${(ma / 1000).toFixed(2)} Ga ago`;
  return `${ma.toFixed(2)} Ma ago`;
}

export function formatDurationMa(durationMa) {
  return formatMa(durationMa).replace(" ago", "").replace("Now", "0");
}

export function getItemDurationMa(item) {
  return item.start_ma - item.end_ma;
}

export function getTimelineRange(items, paddingRatio = 0.03) {
  if (!items.length) return null;

  let minMa = Infinity;
  let maxMa = -Infinity;

  for (const item of items) {
    minMa = Math.min(minMa, item.end_ma);
    maxMa = Math.max(maxMa, item.start_ma);
  }

  const span = maxMa - minMa;
  const fallbackPad = Math.max(Math.abs(maxMa || minMa) * paddingRatio, 1);
  const pad = span === 0 ? fallbackPad : span * paddingRatio;

  return {
    minMa,
    maxMa,
    span,
    viewMin: minMa - pad,
    viewMax: maxMa + pad,
  };
}

export function toLogRatio(ma, minMa, maxMa) {
  const minLog = signedLog(minMa);
  const maxLog = signedLog(maxMa);
  const denominator = maxLog - minLog;

  if (denominator === 0) return 0.5;

  return (signedLog(ma) - minLog) / denominator;
}

export function signedLog(value) {
  if (value === 0) return 0;

  return Math.sign(value) * Math.log10(1 + Math.abs(value));
}

export function createPercentMapper(range, mode = SCALE_MODES.LINEAR) {
  const { viewMin, viewMax } = range;
  const denominator = viewMax - viewMin;

  return (ma) => {
    if (denominator === 0) return 50;

    if (mode === SCALE_MODES.LOG) {
      return (1 - toLogRatio(ma, viewMin, viewMax)) * 100;
    }

    return ((viewMax - ma) / denominator) * 100;
  };
}

export function makeTicks(range, toPercent, count = 6) {
  const ticks = [];

  for (let index = 0; index <= count; index++) {
    const ma = range.viewMin + (range.viewMax - range.viewMin) * (index / count);
    ticks.push({ ma, pct: toPercent(ma) });
  }

  return ticks;
}
