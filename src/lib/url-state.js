export function readFiniteUrlNumber(params, key) {
  const rawValue = params.get(key);
  if (rawValue === null || rawValue.trim() === "") return null;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}
