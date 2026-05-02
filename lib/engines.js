/**
 * Engine CRUD and validation utilities (pure functions).
 */

/**
 * Find engine by keyword or alias (case-insensitive).
 */
export function findEngineByKeyword(engines, keyword) {
  const kw = keyword.toLowerCase();
  return engines.find(e =>
    e.enabled && (
      e.keyword === kw ||
      (Array.isArray(e.aliases) && e.aliases.includes(kw))
    )
  ) || null;
}

/**
 * Validate an engine definition before saving.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateEngine(engine, existingEngines = [], editingId = null) {
  const errors = [];

  if (!engine.name || !engine.name.trim()) {
    errors.push('Name is required.');
  }

  if (!engine.keyword || !engine.keyword.trim()) {
    errors.push('Keyword is required.');
  } else if (!/^[a-z0-9_-]+$/.test(engine.keyword)) {
    errors.push('Keyword must be lowercase letters, numbers, hyphens, or underscores only.');
  } else {
    // Check uniqueness
    const conflict = existingEngines.find(e =>
      e.id !== editingId && (
        e.keyword === engine.keyword ||
        (Array.isArray(e.aliases) && e.aliases.includes(engine.keyword))
      )
    );
    if (conflict) {
      errors.push(`Keyword "${engine.keyword}" is already used by "${conflict.name}".`);
    }
  }

  if (!engine.searchUrl || !engine.searchUrl.trim()) {
    errors.push('Search URL is required.');
  } else if (!engine.searchUrl.includes('%s')) {
    errors.push('Search URL must contain %s as the query placeholder.');
  }

  if (engine.suggestionsUrl && engine.suggestionsUrl.trim()) {
    try {
      new URL(engine.suggestionsUrl);
      if (!engine.suggestionsUrl.includes('%s')) {
        errors.push('Suggestions URL must contain %s as the query placeholder.');
      }
    } catch {
      errors.push('Suggestions URL is not a valid URL.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Add a new engine to the list. Assigns a generated id and order.
 */
export function addEngine(engines, newEngine) {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const order = engines.length;
  return [...engines, { ...newEngine, id, order, isDefault: false }];
}

/**
 * Update an existing engine by id.
 */
export function updateEngine(engines, id, patch) {
  return engines.map(e => e.id === id ? { ...e, ...patch } : e);
}

/**
 * Delete an engine. Prevents deletion of default engines.
 */
export function deleteEngine(engines, id) {
  const engine = engines.find(e => e.id === id);
  if (engine && engine.isDefault) {
    throw new Error(`Cannot delete default engine "${engine.name}". Disable it instead.`);
  }
  return engines.filter(e => e.id !== id);
}

/**
 * Reorder engines by moving fromIndex to toIndex.
 */
export function reorderEngines(engines, fromIndex, toIndex) {
  const result = [...engines];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result.map((e, i) => ({ ...e, order: i }));
}

/**
 * Get the default engine (first enabled one, or the one marked as default).
 */
export function getDefaultEngine(engines, defaultEngineId = 'google') {
  return (
    engines.find(e => e.id === defaultEngineId && e.enabled) ||
    engines.find(e => e.enabled) ||
    null
  );
}

/**
 * Check for keyword conflicts across all engines.
 * Returns array of { engineIds, keyword } conflict objects.
 */
export function detectConflicts(engines) {
  const keywordMap = {};
  const conflicts = [];

  for (const engine of engines) {
    const kws = [engine.keyword, ...(engine.aliases || [])];
    for (const kw of kws) {
      if (!kw) continue;
      if (!keywordMap[kw]) keywordMap[kw] = [];
      keywordMap[kw].push(engine.id);
    }
  }

  for (const [kw, ids] of Object.entries(keywordMap)) {
    if (ids.length > 1) conflicts.push({ keyword: kw, engineIds: ids });
  }

  return conflicts;
}
