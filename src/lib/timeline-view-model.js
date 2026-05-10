import {
  SCALE_MODES,
  createPercentMapper,
  formatDurationMa,
  formatMa,
  getTimelineRange,
  makeTicks,
} from "./time-scale.js";

export function buildTimelineViewModel(items, options = {}) {
  const { isLog = false, tickCount = 6, typeColors } = options;
  const range = getTimelineRange(items);

  if (!range) return null;

  const toPercent = createPercentMapper(range, isLog ? SCALE_MODES.LOG : SCALE_MODES.LINEAR);
  const getColor = createTypeColorPicker(typeColors ?? { event: ["#888888"] });
  const segments = items.map((item) => {
    const leftPct = toPercent(item.start_ma);
    const rightPct = toPercent(item.end_ma);
    const widthPct = Math.abs(rightPct - leftPct);

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      start_ma: item.start_ma,
      end_ma: item.end_ma,
      color: getColor(item),
      left: Math.min(leftPct, rightPct),
      width: widthPct,
      isPoint: widthPct < 0.05,
    };
  });

  return {
    range,
    segments,
    ticks: makeTicks(range, toPercent, tickCount),
    nowPct: range.viewMin <= 0 && range.viewMax >= 0 ? toPercent(0) : null,
    labels: {
      rangeStart: formatMa(range.viewMax),
      rangeEnd: formatMa(range.viewMin),
      span: formatDurationMa(Math.abs(range.viewMax - range.viewMin)),
    },
    selectedCount: items.length,
  };
}

function createTypeColorPicker(typeColors) {
  const counters = {};

  return (item) => {
    const palette = typeColors[item.type] || typeColors.event || ["#888888"];
    counters[item.type] = counters[item.type] || 0;
    const color = palette[counters[item.type] % palette.length];
    counters[item.type]++;
    return color;
  };
}
