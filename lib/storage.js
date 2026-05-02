import { DEFAULT_SETTINGS } from './defaults.js';

/**
 * Deep merge two objects (source into target)
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Get the full settings object, merging stored data with defaults.
 * On first run (no stored data), initializes with DEFAULT_SETTINGS.
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      if (result.settings) {
        // Merge to ensure any new default fields are present
        const merged = deepMerge(DEFAULT_SETTINGS, result.settings);
        resolve(merged);
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

/**
 * Save the full settings object to storage.
 */
export async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, resolve);
  });
}

/**
 * Convenience: get engines array from settings.
 */
export async function getEngines() {
  const settings = await getSettings();
  return settings.engines;
}

/**
 * Convenience: save engines (updates settings.engines).
 */
export async function saveEngines(engines) {
  const settings = await getSettings();
  settings.engines = engines;
  return saveSettings(settings);
}

/**
 * Reset all settings to defaults.
 */
export async function resetToDefaults() {
  return new Promise((resolve) => {
    chrome.storage.sync.clear(() => {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, resolve);
    });
  });
}
