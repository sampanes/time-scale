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
