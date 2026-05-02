/**
 * SearchShift — Background Service Worker
 * Handles omnibox events, context menus, and first-run setup.
 */

import { getSettings, saveSettings } from './lib/storage.js';
import { parseQuery, detectPrefixMode } from './lib/omnibox.js';
import { fetchSuggestions, buildMultiEngineSuggestions } from './lib/suggestions.js';
import { findEngineByKeyword, getDefaultEngine } from './lib/engines.js';
import { DEFAULT_SETTINGS } from './lib/defaults.js';

// ─── Debounce helpers ───────────────────────────────────────────────────────

let debounceTimer = null;
let currentAbortController = null;

function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(debounceTimer);
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    debounceTimer = setTimeout(() => fn(...args, signal), delay);
  };
}

// ─── Omnibox ─────────────────────────────────────────────────────────────────

chrome.omnibox.setDefaultSuggestion({
  description: 'Type to search — use @keyword to pick an engine (e.g. @google, @ddg, @yt)'
});

const handleInputChanged = debounce(async (text, suggest, signal) => {
  if (!text.trim()) {
    suggest([]);
    return;
  }

  let settings;
  try {
    settings = await getSettings();
  } catch {
    suggest([]);
    return;
  }

  const { engines, atTagEnabled, omniboxModeEnabled, showSuggestionsFromAll, maxSuggestionsPerEngine, defaultEngineId } = settings;

  // --- Classic prefix mode (e.g. "ddg best headphones")
  if (omniboxModeEnabled) {
    const prefixMatch = detectPrefixMode(text, engines);
    if (prefixMatch) {
      const suggestions = await fetchSuggestions(prefixMatch.engine, prefixMatch.query, signal);
      if (signal.aborted) return;

      chrome.omnibox.setDefaultSuggestion({
        description: `Search ${prefixMatch.engine.name} for "${prefixMatch.query}"`
      });

      suggest(suggestions.map(s => ({
        content: `__engine:${prefixMatch.engine.id}__${s}`,
        description: s
      })));
      return;
    }
  }

  // --- @tag mode
  const { query, engineKeyword } = atTagEnabled ? parseQuery(text) : { query: text.trim(), engineKeyword: null };

  if (engineKeyword) {
    const engine = findEngineByKeyword(engines, engineKeyword);

    if (!engine) {
      // Unknown @keyword
      chrome.omnibox.setDefaultSuggestion({
        description: `⚠ Unknown engine "@${engineKeyword}" — press Enter to search with default`
      });
      suggest([]);
      return;
    }

    // Single-engine mode
    chrome.omnibox.setDefaultSuggestion({
      description: `Search ${engine.name} for "${query}"`
    });

    if (!query) { suggest([]); return; }

    const suggestions = await fetchSuggestions(engine, query, signal);
    if (signal.aborted) return;

    suggest(suggestions.map(s => ({
      content: `__engine:${engine.id}__${s}`,
      description: s
    })));
    return;
  }

  // --- Multi-engine mode (no @tag)
  if (!showSuggestionsFromAll || !query) {
    const defaultEngine = getDefaultEngine(engines, defaultEngineId);
    if (defaultEngine) {
      chrome.omnibox.setDefaultSuggestion({
        description: `Search ${defaultEngine.name} for "${query}"`
      });
    }
    suggest([]);
    return;
  }

  chrome.omnibox.setDefaultSuggestion({
    description: `Type to search — @keyword to pick one engine specifically`
  });

  const multiSuggestions = await buildMultiEngineSuggestions(engines, query, signal, 6);
  if (signal.aborted) return;

  if (multiSuggestions.length === 0) {
    suggest([]);
    return;
  }

  suggest(multiSuggestions.map(({ text, engineName, engineId, isFallback }) => ({
    content: `__engine:${engineId}__${text}`,
    description: isFallback
      ? `[${engineName}] ${text}` // fallback: just show engine + raw query
      : `[${engineName}] ${text}`
  })));
}, 400);

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  handleInputChanged(text, suggest);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const settings = await getSettings();
  const { engines, atTagEnabled, omniboxModeEnabled, defaultEngineId } = settings;

  let engineId = null;
  let query = text;

  // Check if suggestion content has our engine marker
  const engineMarker = text.match(/^__engine:(.+?)__(.*)$/);
  if (engineMarker) {
    engineId = engineMarker[1];
    query = engineMarker[2];
  } else {
    // Parse the raw text
    if (omniboxModeEnabled) {
      const prefixMatch = detectPrefixMode(text, engines);
      if (prefixMatch) {
        engineId = prefixMatch.engine.id;
        query = prefixMatch.query;
      }
    }

    if (!engineId && atTagEnabled) {
      const parsed = parseQuery(text);
      query = parsed.query;
      if (parsed.engineKeyword) {
        const engine = findEngineByKeyword(engines, parsed.engineKeyword);
        if (engine) engineId = engine.id;
      }
    }
  }

  const engine = engines.find(e => e.id === engineId) ||
    getDefaultEngine(engines, defaultEngineId);

  if (!engine || !query) return;

  const searchUrl = engine.searchUrl.replace('%s', encodeURIComponent(query));

  switch (disposition) {
    case 'currentTab':
      chrome.tabs.update({ url: searchUrl });
      break;
    case 'newForegroundTab':
      chrome.tabs.create({ url: searchUrl });
      break;
    case 'newBackgroundTab':
      chrome.tabs.create({ url: searchUrl, active: false });
      break;
    default:
      chrome.tabs.update({ url: searchUrl });
  }
});

// ─── Context Menu ─────────────────────────────────────────────────────────────

async function rebuildContextMenus() {
  chrome.contextMenus.removeAll(async () => {
    const settings = await getSettings();
    const enabledEngines = settings.engines.filter(e => e.enabled);

    if (enabledEngines.length === 0) return;

    chrome.contextMenus.create({
      id: 'searchshift-parent',
      title: 'Search with...',
      contexts: ['selection']
    });

    for (const engine of enabledEngines) {
      chrome.contextMenus.create({
        id: `searchshift-engine-${engine.id}`,
        parentId: 'searchshift-parent',
        title: engine.name,
        contexts: ['selection']
      });
    }
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.menuItemId.startsWith('searchshift-engine-')) return;
  const engineId = info.menuItemId.replace('searchshift-engine-', '');
  const settings = await getSettings();
  const engine = settings.engines.find(e => e.id === engineId);
  if (!engine || !info.selectionText) return;
  const url = engine.searchUrl.replace('%s', encodeURIComponent(info.selectionText));
  chrome.tabs.create({ url });
});

// Rebuild menus when storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    rebuildContextMenus();
  }
});

// ─── Migration: fix JSONP suggestion URLs ─────────────────────────────────────

async function migrateStoredSettings() {
  const stored = await new Promise(resolve =>
    chrome.storage.sync.get('settings', r => resolve(r.settings))
  );
  if (!stored || !Array.isArray(stored.engines)) return;

  let changed = false;
  const engines = stored.engines.map(e => {
    let updated = { ...e };

    // Fix JSONP suggestion URLs
    let url = updated.suggestionsUrl || '';
    if (url.includes('client=chrome')) {
      updated.suggestionsUrl = url.replace('client=chrome', 'client=firefox');
      changed = true;
    }
    if (url.includes('client=youtube')) {
      updated.suggestionsUrl = url.replace('client=youtube', 'client=firefox');
      changed = true;
    }

    // Add showInSuggestions default if missing
    if (typeof updated.showInSuggestions === 'undefined') {
      updated.showInSuggestions = true;
      changed = true;
    }

    return updated;
  });

  if (changed) {
    await new Promise(resolve =>
      chrome.storage.sync.set({ settings: { ...stored, engines } }, resolve)
    );
  }
}

// ─── First-run Setup ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Initialize storage with defaults (use static import — dynamic import() not allowed in SW)
    await new Promise(resolve => chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, resolve));

    // Open options page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('options/index.html') });
  } else {
    // On update, migrate any old JSONP suggestion URLs
    await migrateStoredSettings();
  }

  rebuildContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await migrateStoredSettings();
  rebuildContextMenus();
});
