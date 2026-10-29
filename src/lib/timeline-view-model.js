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
const DEFAULT_POINT_LABEL_STACK_PX = 26;
const CLUSTER_SPREAD_GAP_FACTOR = 1.4;
const CLUSTER_SPREAD_VIEWPORT_FRACTION = 0.6;
const CLUSTER_SPREAD_MIN_FACTOR = 1.5;

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

// Instants whose label boxes would overprint each other collapse into one labeled stack: the
// oldest keeps its label plus a count, the rest draw only their lines until a zoom pulls them
// apart. A stack is measured from its leader, so each visible label clears the next one.
function annotatePointClusters(segments, labelStackPx) {
  const points = segments.filter((segment) => segment.isPoint).sort((a, b) => a.y - b.y);
  let leader = null;

  for (const point of points) {
    if (leader && point.y - leader.y < labelStackPx) {
      leader.cluster.ids.push(point.id);
      leader.cluster.names.push(point.name);
      leader.cluster.mas.push(point.start_ma);
      leader.cluster.minMa = Math.min(leader.cluster.minMa, point.start_ma);
      leader.cluster.maxMa = Math.max(leader.cluster.maxMa, point.start_ma);
      point.labelVisible = false;
      point.clusterLeaderId = leader.id;
      point.cluster = null;
      continue;
    }

    leader = point;
    point.labelVisible = true;
    point.clusterLeaderId = null;
    point.cluster = { ids: [point.id], names: [point.name], mas: [point.start_ma], minMa: point.start_ma, maxMa: point.start_ma };
  }

  for (const point of points) {
    if (point.cluster && point.cluster.ids.length < 2) point.cluster = null;
  }

  return segments;
}

// The zoom that pulls a stack apart: enough that its closest neighbors clear the label height,
// but never more than fits the stack in most of the viewport, so a tap is one step toward the
// detail rather than a leap to an unrelated scale. Null when every member shares one moment.
export function getClusterSpreadPxPerMa(cluster, options = {}) {
  const { pxPerMa, viewportHeight, labelStackPx = DEFAULT_POINT_LABEL_STACK_PX, maxPxPerMa = Infinity } = options;
  const spanMa = cluster.maxMa - cluster.minMa;
  if (!(spanMa > 0)) return null;

  const sortedMas = [...cluster.mas].sort((a, b) => a - b);
  let minGapMa = spanMa;
  for (let index = 1; index < sortedMas.length; index++) {
    const gap = sortedMas[index] - sortedMas[index - 1];
    if (gap > 0 && gap < minGapMa) minGapMa = gap;
  }

  const spreadPxPerMa = (labelStackPx * CLUSTER_SPREAD_GAP_FACTOR) / minGapMa;
  const fitPxPerMa = (viewportHeight * CLUSTER_SPREAD_VIEWPORT_FRACTION) / spanMa;
  return Math.min(maxPxPerMa, Math.max(pxPerMa * CLUSTER_SPREAD_MIN_FACTOR, Math.min(spreadPxPerMa, fitPxPerMa)));
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
    pointLabelStackPx = DEFAULT_POINT_LABEL_STACK_PX,
  } = options;
  const range = getVerticalTimelineRange(items, { rangePaddingRatio, minSinglePointSpanMa });

  if (!range) return null;

  const getColor = createTypeColorPicker(typeColors ?? { event: ["#888888"] });
  const nowActive = items.some((item) => item.id === "now");
  const renderableItems = items.filter((item) => item.id !== "now");
  const maxDurationMa = Math.max(...renderableItems.map((item) => Math.abs(item.start_ma - item.end_ma)), 0);
  const maxDurationScale = Math.log10(maxDurationMa + 1);
  const segments = annotateSegmentOverlap(renderableItems.map((item) => {
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

  annotatePointClusters(segments, pointLabelStackPx);

  return {
    range,
    pxPerMa,
    offsetY,
    viewportHeight,
    contentHeight: getContentHeight(range, pxPerMa),
    segments,
    ticks: makeVisibleTicks({ range, pxPerMa, viewportHeight, offsetY, referenceYear }),
    nowY: range.viewMin <= 0 && range.viewMax >= 0 ? maToY(0, range, pxPerMa) : null,
    nowActive,
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
  let flushOlder = false;
  let flushNewer = false;

  for (const item of items) {
    const itemMin = Math.min(item.start_ma, item.end_ma);
    const itemMax = Math.max(item.start_ma, item.end_ma);
    if (itemMax > maxMa) {
      maxMa = itemMax;
      flushOlder = Boolean(item.noPadOlder);
    } else if (itemMax === maxMa && item.noPadOlder) {
      flushOlder = true;
    }
    if (itemMin < minMa) {
      minMa = itemMin;
      flushNewer = Boolean(item.noPadNewer);
    } else if (itemMin === minMa && item.noPadNewer) {
      flushNewer = true;
    }
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
    viewMin: flushNewer ? paddedMinMa : paddedMinMa - pad,
    viewMax: flushOlder ? paddedMaxMa : paddedMaxMa + pad,
  };
}
