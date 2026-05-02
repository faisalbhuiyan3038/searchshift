/**
 * SearchShift Options Page Script
 */

// ── State ──────────────────────────────────────────────────────────────────
let settings = null;
let editingEngineId = null;
const originalTrigger = { value: null };

// ── Storage helpers ────────────────────────────────────────────────────────
async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', result => resolve(result.settings || null));
  });
}

async function persistSettings(s) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ settings: s }, resolve);
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = (type === 'success' ? '✓ ' : '✗ ') + msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ── Navigation ─────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');
  });
});

// ── Engine Emojis ──────────────────────────────────────────────────────────
const EMOJIS = { google: '🔍', bing: '🅱', duckduckgo: '🦆', perplexity: '🤖', brave: '🦁', youtube: '▶', wikipedia: '📖' };
function emojiFor(e) { return EMOJIS[e.id] || EMOJIS[e.keyword] || '🔍'; }

// ── Engine List Rendering ──────────────────────────────────────────────────
function renderEngines() {
  const container = document.getElementById('engine-list');
  if (!settings || !settings.engines.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No engines yet.</p></div>';
    return;
  }

  const sorted = [...settings.engines].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  container.innerHTML = sorted.map((engine, idx) => `
    <div class="engine-row" data-id="${engine.id}" data-idx="${idx}">
      <span class="engine-drag" title="Drag to reorder">⋮⋮</span>
      <div class="engine-icon-cell">
        ${engine.icon
          ? `<img src="${engine.icon}" alt="${engine.name}" onerror="this.parentElement.textContent='${emojiFor(engine)}'">`
          : emojiFor(engine)}
      </div>
      <div class="engine-details">
        <div class="engine-title">${engine.name}${engine.isDefault ? ' <span class="lock-icon" title="Default engine">🔒</span>' : ''}</div>
        <div class="engine-meta">
          <span class="kw-badge">@${engine.keyword}</span>
          ${(engine.aliases||[]).map(a => `<span class="kw-badge">@${a}</span>`).join('')}
          ${engine.suggestionsUrl
            ? '<span class="suggest-badge">✓ Suggestions</span>'
            : '<span class="no-suggest-badge">No suggestions</span>'}
          ${engine.showInSuggestions !== false
            ? '<span class="suggest-badge" title="Appears in omnibox list">📋 In omnibox</span>'
            : '<span class="no-suggest-badge" title="@keyword only — not in omnibox list">@keyword only</span>'}
        </div>
      </div>
      <div class="engine-actions">
        <label class="toggle" title="${engine.enabled ? 'Disable' : 'Enable'}">
          <input type="checkbox" class="eng-toggle" data-id="${engine.id}" ${engine.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <button class="btn btn-secondary btn-icon eng-edit" data-id="${engine.id}" title="Edit">✏️</button>
        ${!engine.isDefault
          ? `<button class="btn btn-danger btn-icon eng-delete" data-id="${engine.id}" title="Delete">🗑</button>`
          : ''}
      </div>
    </div>
  `).join('');

  // Bind events
  container.querySelectorAll('.eng-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      settings.engines = settings.engines.map(e =>
        e.id === cb.dataset.id ? { ...e, enabled: cb.checked } : e
      );
      await persistSettings(settings);
      renderConflicts();
      showToast(`${cb.checked ? 'Enabled' : 'Disabled'} engine`);
    });
  });

  container.querySelectorAll('.eng-edit').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });

  container.querySelectorAll('.eng-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete this engine?`)) return;
      settings.engines = settings.engines.filter(e => e.id !== btn.dataset.id);
      await persistSettings(settings);
      renderEngines();
      renderConflicts();
      showToast('Engine deleted');
    });
  });

  // Simple drag-to-reorder (mousedown based)
  setupDragReorder(container);
}

// ── Simple Drag Reorder ────────────────────────────────────────────────────
function setupDragReorder(container) {
  let dragSrc = null;

  container.querySelectorAll('.engine-row').forEach(row => {
    row.draggable = true;
    row.addEventListener('dragstart', () => {
      dragSrc = row;
      row.style.opacity = '0.4';
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '';
      dragSrc = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== row) row.style.background = 'var(--surface3)';
    });
    row.addEventListener('dragleave', () => row.style.background = '');
    row.addEventListener('drop', async e => {
      e.preventDefault();
      row.style.background = '';
      if (!dragSrc || dragSrc === row) return;

      const fromId = dragSrc.dataset.id;
      const toId = row.dataset.id;
      const fromIdx = settings.engines.findIndex(e => e.id === fromId);
      const toIdx = settings.engines.findIndex(e => e.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;

      const arr = [...settings.engines];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      settings.engines = arr.map((e, i) => ({ ...e, order: i }));

      await persistSettings(settings);
      renderEngines();
      showToast('Order saved');
    });
  });
}

// ── Conflict Detection ─────────────────────────────────────────────────────
function renderConflicts() {
  const banner = document.getElementById('conflict-banner');
  const conflicts = detectConflicts(settings.engines);
  if (!conflicts.length) { banner.style.display = 'none'; return; }

  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="alert alert-warning" style="margin-bottom:16px">
      <span class="alert-icon">⚠️</span>
      <div>
        <strong>Keyword conflicts detected:</strong>
        <div class="conflict-list" style="margin-top:6px">
          ${conflicts.map(c => {
            const names = c.engineIds.map(id => settings.engines.find(e => e.id === id)?.name || id).join(', ');
            return `<div class="conflict-item">@${c.keyword} used by: ${names}</div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function detectConflicts(engines) {
  const map = {};
  const conflicts = [];
  for (const e of engines) {
    for (const kw of [e.keyword, ...(e.aliases || [])].filter(Boolean)) {
      if (!map[kw]) map[kw] = [];
      map[kw].push(e.id);
    }
  }
  for (const [kw, ids] of Object.entries(map)) {
    if (ids.length > 1) conflicts.push({ keyword: kw, engineIds: ids });
  }
  return conflicts;
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(engineId = null) {
  editingEngineId = engineId;
  const isEdit = !!engineId;
  const engine = isEdit ? settings.engines.find(e => e.id === engineId) : null;

  document.getElementById('modal-title').textContent = isEdit ? 'Edit Engine' : 'Add Engine';
  document.getElementById('field-name').value = engine?.name || '';
  document.getElementById('field-keyword').value = engine?.keyword || '';
  document.getElementById('field-search-url').value = engine?.searchUrl || '';
  document.getElementById('field-suggest-url').value = engine?.suggestionsUrl || '';
  document.getElementById('field-show-in-suggestions').checked = engine ? (engine.showInSuggestions !== false) : true;
  document.getElementById('field-omnibox-mode').checked = engine?.omniboxMode || false;
  document.getElementById('modal-errors').style.display = 'none';
  document.getElementById('modal-errors').innerHTML = '';

  document.getElementById('engine-modal').classList.add('open');
  document.getElementById('field-name').focus();
}

function closeModal() {
  document.getElementById('engine-modal').classList.remove('open');
  editingEngineId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('engine-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('engine-modal')) closeModal();
});

document.getElementById('btn-add-engine').addEventListener('click', () => openModal());

document.getElementById('modal-save').addEventListener('click', async () => {
  const name = document.getElementById('field-name').value.trim();
  const keyword = document.getElementById('field-keyword').value.trim().toLowerCase();
  const searchUrl = document.getElementById('field-search-url').value.trim();
  const suggestionsUrl = document.getElementById('field-suggest-url').value.trim();
  const showInSuggestions = document.getElementById('field-show-in-suggestions').checked;
  const omniboxMode = document.getElementById('field-omnibox-mode').checked;

  const errors = [];
  if (!name) errors.push('Engine name is required.');
  if (!keyword) errors.push('Keyword is required.');
  else if (!/^[a-z0-9_-]+$/.test(keyword)) errors.push('Keyword must be lowercase letters, numbers, hyphens, or underscores.');
  else {
    const conflict = settings.engines.find(e =>
      e.id !== editingEngineId && (e.keyword === keyword || (e.aliases || []).includes(keyword))
    );
    if (conflict) errors.push(`Keyword "@${keyword}" is already used by "${conflict.name}".`);
  }
  if (!searchUrl) errors.push('Search URL is required.');
  else if (!searchUrl.includes('%s')) errors.push('Search URL must contain %s as the placeholder.');
  if (suggestionsUrl && !suggestionsUrl.includes('%s')) errors.push('Suggestions URL must contain %s as the placeholder.');

  if (errors.length) {
    const errEl = document.getElementById('modal-errors');
    errEl.style.display = 'block';
    errEl.innerHTML = `<div class="alert alert-error"><span class="alert-icon">✗</span><ul style="padding-left:16px">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`;
    return;
  }

  const data = { name, keyword, searchUrl, suggestionsUrl, omniboxMode, showInSuggestions };

  if (editingEngineId) {
    settings.engines = settings.engines.map(e =>
      e.id === editingEngineId ? { ...e, ...data } : e
    );
    showToast('Engine updated');
  } else {
    const id = `custom_${Date.now()}`;
    settings.engines.push({ ...data, id, aliases: [], enabled: true, isDefault: false, order: settings.engines.length });
    showToast('Engine added');
  }

  await persistSettings(settings);
  closeModal();
  renderEngines();
  renderConflicts();
});

// ── Settings Tab ───────────────────────────────────────────────────────────
function populateSettings() {
  document.getElementById('trigger-keyword').value = settings.triggerKeyword || 's';
  document.getElementById('at-tag-enabled').checked = settings.atTagEnabled !== false;
  document.getElementById('omnibox-mode-enabled').checked = !!settings.omniboxModeEnabled;
  document.getElementById('show-suggestions-from-all').checked = settings.showSuggestionsFromAll !== false;
  document.getElementById('max-suggestions').value = String(settings.maxSuggestionsPerEngine || 2);

  originalTrigger.value = settings.triggerKeyword || 's';

  // Default engine select
  const sel = document.getElementById('default-engine-select');
  sel.innerHTML = settings.engines.map(e =>
    `<option value="${e.id}" ${e.id === settings.defaultEngineId ? 'selected' : ''}>${e.name}</option>`
  ).join('');
}

document.getElementById('trigger-keyword').addEventListener('input', e => {
  const changed = e.target.value !== originalTrigger.value;
  document.getElementById('trigger-change-banner').style.display = changed ? 'flex' : 'none';
});

document.getElementById('btn-reload-ext').addEventListener('click', () => chrome.runtime.reload());

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  settings.triggerKeyword = document.getElementById('trigger-keyword').value.trim() || 's';
  settings.atTagEnabled = document.getElementById('at-tag-enabled').checked;
  settings.omniboxModeEnabled = document.getElementById('omnibox-mode-enabled').checked;
  settings.showSuggestionsFromAll = document.getElementById('show-suggestions-from-all').checked;
  settings.maxSuggestionsPerEngine = parseInt(document.getElementById('max-suggestions').value, 10);
  settings.defaultEngineId = document.getElementById('default-engine-select').value;

  await persistSettings(settings);
  showToast('Settings saved');
  document.getElementById('trigger-change-banner').style.display = 'none';
  originalTrigger.value = settings.triggerKeyword;
});

// ── Backup Tab ─────────────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  const json = JSON.stringify(settings, null, 2);
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `searchshift-backup-${date}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported');
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    showBackupStatus('error', '✗ Invalid JSON file — could not parse.');
    return;
  }

  if (!parsed || !Array.isArray(parsed.engines)) {
    showBackupStatus('error', '✗ Invalid backup — missing "engines" array.');
    return;
  }

  if (!confirm(`Import ${parsed.engines.length} engines from backup? This will replace your current settings.`)) return;

  settings = { ...settings, ...parsed };
  await persistSettings(settings);
  renderEngines();
  populateSettings();
  showBackupStatus('success', `✓ Imported ${parsed.engines.length} engines successfully.`);
  showToast('Backup imported');
  e.target.value = '';
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset all settings to factory defaults? Custom engines will be permanently deleted.')) return;

  const { DEFAULT_SETTINGS } = await getDefaults();
  settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  await persistSettings(settings);
  renderEngines();
  populateSettings();
  renderConflicts();
  showBackupStatus('success', '✓ Reset to defaults.');
  showToast('Reset complete');
});

function showBackupStatus(type, msg) {
  const el = document.getElementById('backup-status');
  el.innerHTML = `<div class="alert alert-${type === 'error' ? 'error' : 'success'}" style="margin-top:16px"><span class="alert-icon">${type === 'error' ? '✗' : '✓'}</span><span>${msg}</span></div>`;
  setTimeout(() => { el.innerHTML = ''; }, 5000);
}

// Dynamic import workaround for service-worker context (options page is a regular page)
async function getDefaults() {
  // Inline defaults so we don't need dynamic import in options context
  return {
    DEFAULT_SETTINGS: {
      engines: [
        { id:'google', name:'Google', keyword:'google', aliases:['g'], searchUrl:'https://www.google.com/search?q=%s', suggestionsUrl:'https://suggestqueries.google.com/complete/search?client=firefox&q=%s', icon:'https://www.google.com/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:0 },
        { id:'bing', name:'Bing', keyword:'bing', aliases:['b'], searchUrl:'https://www.bing.com/search?q=%s', suggestionsUrl:'https://api.bing.com/osjson.aspx?query=%s', icon:'https://www.bing.com/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:1 },
        { id:'duckduckgo', name:'DuckDuckGo', keyword:'ddg', aliases:['d'], searchUrl:'https://duckduckgo.com/?q=%s', suggestionsUrl:'https://duckduckgo.com/ac/?q=%s&type=list', icon:'https://duckduckgo.com/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:2 },
        { id:'perplexity', name:'Perplexity', keyword:'perplexity', aliases:['p'], searchUrl:'https://www.perplexity.ai/search?q=%s', suggestionsUrl:'', icon:'https://www.perplexity.ai/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:3 },
        { id:'brave', name:'Brave Search', keyword:'brave', aliases:[], searchUrl:'https://search.brave.com/search?q=%s', suggestionsUrl:'', icon:'https://brave.com/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:4 },
        { id:'youtube', name:'YouTube', keyword:'yt', aliases:[], searchUrl:'https://www.youtube.com/results?search_query=%s', suggestionsUrl:'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=%s', icon:'https://www.youtube.com/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:5 },
        { id:'wikipedia', name:'Wikipedia', keyword:'wiki', aliases:['w'], searchUrl:'https://en.wikipedia.org/w/index.php?search=%s', suggestionsUrl:'https://en.wikipedia.org/w/api.php?action=opensearch&search=%s&limit=5&format=json&origin=*', icon:'https://www.wikipedia.org/favicon.ico', omniboxMode:false, enabled:true, isDefault:true, order:6 }
      ],
      triggerKeyword:'s', atTagEnabled:true, omniboxModeEnabled:false, showSuggestionsFromAll:true, maxSuggestionsPerEngine:2, defaultEngineId:'google'
    }
  };
}

// ── Migration: fix JSONP URLs + add missing showInSuggestions ──────────────
function migrateSettings(s) {
  if (!s || !Array.isArray(s.engines)) return s;
  let changed = false;
  const engines = s.engines.map(e => {
    let updated = { ...e };
    let url = updated.suggestionsUrl || '';
    if (url.includes('client=chrome')) {
      updated.suggestionsUrl = url.replace('client=chrome', 'client=firefox');
      changed = true;
    }
    if (url.includes('client=youtube')) {
      updated.suggestionsUrl = url.replace('client=youtube', 'client=firefox');
      changed = true;
    }
    if (typeof updated.showInSuggestions === 'undefined') {
      updated.showInSuggestions = true;
      changed = true;
    }
    return updated;
  });
  return changed ? { ...s, engines } : s;
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  settings = await loadSettings();

  if (!settings) {
    const { DEFAULT_SETTINGS } = await getDefaults();
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    await persistSettings(settings);
  } else {
    // Auto-migrate stored settings
    const migrated = migrateSettings(settings);
    if (migrated !== settings) {
      settings = migrated;
      await persistSettings(settings);
    }
  }

  renderEngines();
  renderConflicts();
  populateSettings();
}

init();
