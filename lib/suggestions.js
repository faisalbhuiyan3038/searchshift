/**
 * Fetch autocomplete suggestions from a search engine's suggestions URL.
 */

const SUGGESTION_TIMEOUT_MS = 2000;
const MAX_SUGGESTIONS = 3;

/**
 * Fetch suggestions for a query from an engine's suggestionsUrl.
 * Returns string[] (may be empty on failure or missing URL).
 * Supports AbortSignal for cancellation.
 */
export async function fetchSuggestions(engine, query, signal = null) {
  if (!engine.suggestionsUrl || !query.trim()) return [];

  const url = engine.suggestionsUrl.replace('%s', encodeURIComponent(query));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUGGESTION_TIMEOUT_MS);

    const fetchSignal = signal
      ? combineSignals(signal, controller.signal)
      : controller.signal;

    const response = await fetch(url, {
      signal: fetchSignal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();

    // OpenSearch suggestion format: [query, [s1, s2, ...], ...]
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, MAX_SUGGESTIONS);
    }

    // DDG format: [{phrase: "..."}, ...]
    if (Array.isArray(data) && data[0] && data[0].phrase) {
      return data.slice(0, MAX_SUGGESTIONS).map(item => item.phrase);
    }

    return [];
  } catch (err) {
    if (err.name === 'AbortError') return [];
    // Silently fail — network error, CORS, parse error, etc.
    return [];
  }
}

/**
 * Build the full multi-engine suggestion list.
 *
 * For engines with showInSuggestions:
 *   - If they have a suggestionsUrl → fetch real autocomplete suggestions
 *   - If they don't → inject one fallback entry: the raw query (so the engine still appears)
 *
 * Returns an interleaved array of { text, engineName, engineId, isFallback }
 * capped at maxTotal.
 */
export async function buildMultiEngineSuggestions(engines, query, signal = null, maxTotal = 6) {
  if (!query.trim()) return [];

  // Split into two groups
  const showList = engines.filter(e => e.enabled && e.showInSuggestions !== false);
  const withUrl  = showList.filter(e => e.suggestionsUrl);
  const noUrl    = showList.filter(e => !e.suggestionsUrl);

  // Fetch real suggestions in parallel
  const fetchResults = await Promise.allSettled(
    withUrl.map(async engine => {
      const suggestions = await fetchSuggestions(engine, query, signal);
      return { engine, suggestions, isFallback: false };
    })
  );

  // Build per-engine queues
  // Start with engines that have real suggestions (in their order)
  const queues = [];

  // Preserve engine display order — interleave in the order engines are listed
  for (const engine of showList) {
    if (engine.suggestionsUrl) {
      const result = fetchResults.find(r =>
        r.status === 'fulfilled' && r.value.engine.id === engine.id
      );
      const suggestions = result?.value?.suggestions || [];
      queues.push({ engine, items: suggestions.map(s => ({ text: s, isFallback: false })) });
    } else {
      // No suggestions URL → one fallback entry showing the raw query
      queues.push({
        engine,
        items: [{ text: query, isFallback: true }]
      });
    }
  }

  // Round-robin interleave
  const results = [];
  while (results.length < maxTotal && queues.some(q => q.items.length > 0)) {
    for (const queue of queues) {
      if (queue.items.length > 0 && results.length < maxTotal) {
        const item = queue.items.shift();
        results.push({
          text: item.text,
          engineName: queue.engine.name,
          engineId: queue.engine.id,
          isFallback: item.isFallback
        });
      }
    }
  }

  return results;
}

/**
 * Helper: combine two AbortSignals (aborts when either fires).
 */
function combineSignals(sig1, sig2) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  sig1.addEventListener('abort', abort, { once: true });
  sig2.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
