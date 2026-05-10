export function normalizeSearchText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fuzzyScore(query, target) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTarget = normalizeSearchText(target);

  if (!normalizedQuery || !normalizedTarget) return 0;
  if (normalizedTarget === normalizedQuery) return 100;
  if (normalizedTarget.startsWith(normalizedQuery)) return 90;
  if (normalizedTarget.includes(normalizedQuery)) return 80;

  let queryIndex = 0;
  let score = 0;

  for (let targetIndex = 0; targetIndex < normalizedTarget.length && queryIndex < normalizedQuery.length; targetIndex++) {
    if (normalizedTarget[targetIndex] === normalizedQuery[queryIndex]) {
      score += queryIndex === targetIndex ? 2 : 1;
      queryIndex++;
    }
  }

  return queryIndex === normalizedQuery.length ? Math.round((score / normalizedQuery.length) * 40) : 0;
}

export function searchTimelineItems(items, query, options = {}) {
  const { limit = 8, minScore = 15 } = options;

  if (!query || query.trim().length < 1) return [];

  return items
    .map((item) => ({
      item,
      score: Math.max(...[item.name, ...(item.aliases ?? [])].map((alias) => fuzzyScore(query, alias))),
    }))
    .filter((result) => result.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => result.item);
}
