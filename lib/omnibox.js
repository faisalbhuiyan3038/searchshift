/**
 * Omnibox query parser — extracts @keyword tags.
 */

/**
 * Parse query input for an @keyword tag.
 * Returns { query, engineKeyword }
 * - query: the clean search query with @tag removed and trimmed
 * - engineKeyword: extracted keyword (lowercase) or null if none found
 */
export function parseQuery(input) {
  if (!input || !input.trim()) {
    return { query: '', engineKeyword: null };
  }

  // Match first valid @keyword (word chars only, so @@ or lone @ are ignored)
  const match = input.match(/@([a-zA-Z][a-zA-Z0-9_-]*)/);

  if (!match) {
    return { query: input.trim(), engineKeyword: null };
  }

  const engineKeyword = match[1].toLowerCase();
  const query = input.replace(match[0], '').replace(/\s+/g, ' ').trim();

  return { query, engineKeyword };
}

/**
 * Detect if input starts with a known engine keyword + space (classic prefix mode).
 * Returns the engine keyword string or null.
 * Example: "ddg best headphones" → "ddg"
 */
export function detectPrefixMode(input, engines) {
  const trimmed = input.trimStart();
  for (const engine of engines) {
    if (!engine.enabled || !engine.omniboxMode) continue;
    const kws = [engine.keyword, ...(engine.aliases || [])];
    for (const kw of kws) {
      if (trimmed.toLowerCase().startsWith(kw + ' ')) {
        return { keyword: kw, engine, query: trimmed.slice(kw.length + 1).trim() };
      }
    }
  }
  return null;
}
