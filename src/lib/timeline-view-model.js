import { formatDurationMa, formatMa } from "./time-scale.js";
import { getContentHeight, maToY, makeVisibleTicks } from "./vertical-scale.js";

const DEFAULT_VERTICAL_PADDING_RATIO = 0.08;
const DEFAULT_MIN_SINGLE_POINT_SPAN_MA = 1;
const DEFAULT_VERTICAL_PX_PER_MA = 0.01;
const DEFAULT_VERTICAL_VIEWPORT_HEIGHT = 800;
const MIN_SEGMENT_FILL_MIX_PCT = 30;
const MAX_SEGMENT_FILL_MIX_PCT = 68;
const MIN_SEGMENT_EDGE_MIX_PCT = 62;
const MAX_SEGMENT_EDGE_MIX_PCT = 90;
const MIN_SEGMENT_GLOW_MIX_PCT = 12;
const MAX_SEGMENT_GLOW_MIX_PCT = 34;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createTypeColorPicker(typeColors) {
  const counters = {};

  return (item) => {
    if (item.color) return item.color;

    const palette = typeColors[item.type] || typeColors.event || ["#888888"];
    counters[item.type] = counters[item.type] || 0;
    const color = palette[counters[item.type] % palette.length];
    counters[item.type]++;
    return color;
  };
}

function annotateSegmentOverlap(segments) {
  const spans = segments.filter((segment) => !segment.isPoint);

  for (const segment of segments) {
    if (segment.isPoint) {
      segment.overlapCount = 1;
      segment.fillMixPct = MIN_SEGMENT_FILL_MIX_PCT;
      segment.edgeMixPct = MIN_SEGMENT_EDGE_MIX_PCT;
      segment.glowMixPct = MIN_SEGMENT_GLOW_MIX_PCT;
      continue;
    }

    const segmentBottom = segment.top + segment.height;
    const overlapCount = spans.filter((candidate) => {
      const candidateBottom = candidate.top + candidate.height;
      return segment.top < candidateBottom && candidate.top < segmentBottom;
    }).length;
    const overlapScale = Math.log2(Math.max(1, overlapCount));

    segment.overlapCount = Math.max(1, overlapCount);
    segment.fillMixPct = Math.round(clamp(MIN_SEGMENT_FILL_MIX_PCT + overlapScale * 10, MIN_SEGMENT_FILL_MIX_PCT, MAX_SEGMENT_FILL_MIX_PCT));
    segment.edgeMixPct = Math.round(clamp(MIN_SEGMENT_EDGE_MIX_PCT + overlapScale * 7, MIN_SEGMENT_EDGE_MIX_PCT, MAX_SEGMENT_EDGE_MIX_PCT));
    segment.glowMixPct = Math.round(clamp(MIN_SEGMENT_GLOW_MIX_PCT + overlapScale * 5, MIN_SEGMENT_GLOW_MIX_PCT, MAX_SEGMENT_GLOW_MIX_PCT));
  }

  return segments;
}

export function buildVerticalTimelineViewModel(items, options = {}) {
  const {
    pxPerMa = DEFAULT_VERTICAL_PX_PER_MA,
    viewportHeight = DEFAULT_VERTICAL_VIEWPORT_HEIGHT,
    offsetY = 0,
    typeColors,
    rangePaddingRatio = DEFAULT_VERTICAL_PADDING_RATIO,
    minSinglePointSpanMa = DEFAULT_MIN_SINGLE_POINT_SPAN_MA,
    referenceYear,
  } = options;
  const range = getVerticalTimelineRange(items, { rangePaddingRatio, minSinglePointSpanMa });

  if (!range) return null;

  const getColor = createTypeColorPicker(typeColors ?? { event: ["#888888"] });
  const maxDurationMa = Math.max(...items.map((item) => Math.abs(item.start_ma - item.end_ma)), 0);
  const maxDurationScale = Math.log10(maxDurationMa + 1);
  const segments = annotateSegmentOverlap(items.map((item) => {
    const startY = maToY(item.start_ma, range, pxPerMa);
    const endY = maToY(item.end_ma, range, pxPerMa);
    const isPoint = Math.abs(item.start_ma - item.end_ma) < 1e-12;
    const durationMa = Math.abs(item.start_ma - item.end_ma);
    const durationScale = maxDurationScale > 0 ? Math.log10(durationMa + 1) / maxDurationScale : 0;
    const zIndex = isPoint ? 60 : Math.max(2, Math.round(42 - durationScale * 30));

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      start_ma: item.start_ma,
      end_ma: item.end_ma,
      color: getColor(item),
      top: Math.min(startY, endY),
      height: isPoint ? 0 : Math.abs(endY - startY),
      y: isPoint ? startY : null,
      isPoint,
      durationMa,
      zIndex,
    };
  }));

  return {
    range,
    pxPerMa,
    offsetY,
    viewportHeight,
    contentHeight: getContentHeight(range, pxPerMa),
    segments,
    ticks: makeVisibleTicks({ range, pxPerMa, viewportHeight, offsetY, referenceYear }),
    nowY: range.viewMin <= 0 && range.viewMax >= 0 ? maToY(0, range, pxPerMa) : null,
    selectedCount: items.length,
    labels: {
      rangeStart: formatMa(range.maxMa),
      rangeEnd: formatMa(range.minMa),
      span: formatDurationMa(Math.abs(range.maxMa - range.minMa)),
    },
  };
}

export function getVerticalTimelineRange(items, options = {}) {
  const { rangePaddingRatio = DEFAULT_VERTICAL_PADDING_RATIO, minSinglePointSpanMa = DEFAULT_MIN_SINGLE_POINT_SPAN_MA } = options;

  if (!items.length) return null;

  let minMa = Infinity;
  let maxMa = -Infinity;

  for (const item of items) {
    minMa = Math.min(minMa, item.start_ma, item.end_ma);
    maxMa = Math.max(maxMa, item.start_ma, item.end_ma);
  }

  const rawSpan = maxMa - minMa;
  const span = rawSpan === 0 ? minSinglePointSpanMa : rawSpan;
  const midpoint = (maxMa + minMa) / 2;
  const paddedMinMa = rawSpan === 0 ? midpoint - span / 2 : minMa;
  const paddedMaxMa = rawSpan === 0 ? midpoint + span / 2 : maxMa;
  const pad = span * rangePaddingRatio;

  return {
    minMa,
    maxMa,
    span: rawSpan,
    viewMin: paddedMinMa - pad,
    viewMax: paddedMaxMa + pad,
  };
}
