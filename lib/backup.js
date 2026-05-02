/**
 * Backup and restore logic for SearchShift settings.
 * No external validation library — uses manual schema checking.
 */

/**
 * Export settings to a JSON string.
 */
export function exportBackup(settings) {
  return JSON.stringify(settings, null, 2);
}

/**
 * Trigger a file download with the given content.
 */
export function downloadBackup(settings) {
  const json = exportBackup(settings);
  const date = new Date().toISOString().split('T')[0];
  const filename = `searchshift-backup-${date}.json`;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate a backup JSON string.
 * Returns { settings } on success, or { error } on failure.
 */
export function importBackup(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { error: 'Invalid JSON: could not parse file.' };
  }

  // Basic schema validation
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Invalid backup: root must be an object.' };
  }

  if (!Array.isArray(parsed.engines)) {
    return { error: 'Invalid backup: missing or invalid "engines" array.' };
  }

  // Validate each engine
  for (let i = 0; i < parsed.engines.length; i++) {
    const e = parsed.engines[i];
    if (!e.id || typeof e.id !== 'string') return { error: `Engine #${i + 1}: missing "id".` };
    if (!e.name || typeof e.name !== 'string') return { error: `Engine #${i + 1}: missing "name".` };
    if (!e.keyword || typeof e.keyword !== 'string') return { error: `Engine #${i + 1}: missing "keyword".` };
    if (!e.searchUrl || typeof e.searchUrl !== 'string') return { error: `Engine #${i + 1}: missing "searchUrl".` };
    if (!e.searchUrl.includes('%s')) return { error: `Engine #${i + 1}: "searchUrl" must contain %s.` };
    if (typeof e.enabled !== 'boolean') e.enabled = true; // repair missing field
    if (typeof e.order !== 'number') e.order = i;
  }

  // Validate settings fields (repair missing with defaults)
  if (typeof parsed.triggerKeyword !== 'string') parsed.triggerKeyword = 's';
  if (typeof parsed.atTagEnabled !== 'boolean') parsed.atTagEnabled = true;
  if (typeof parsed.omniboxModeEnabled !== 'boolean') parsed.omniboxModeEnabled = false;
  if (typeof parsed.showSuggestionsFromAll !== 'boolean') parsed.showSuggestionsFromAll = true;
  if (typeof parsed.maxSuggestionsPerEngine !== 'number') parsed.maxSuggestionsPerEngine = 2;

  return { settings: parsed };
}
