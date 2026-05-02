/**
 * SearchShift Popup Script
 */

// Engine emoji/icon fallbacks
const ENGINE_EMOJIS = {
  google: '🔍',
  bing: '🅱',
  duckduckgo: '🦆',
  perplexity: '🤖',
  brave: '🦁',
  youtube: '▶',
  wikipedia: '📖'
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      resolve(result.settings || null);
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, resolve);
  });
}

function getEmojiForEngine(engine) {
  return ENGINE_EMOJIS[engine.id] || ENGINE_EMOJIS[engine.keyword] || '🔍';
}

function renderEngineList(settings) {
  const container = document.getElementById('engine-list');
  const engines = settings.engines || [];
  const enabled = engines.filter(e => e.enabled);

  if (engines.length === 0) {
    container.innerHTML = '<div class="empty-state">No engines configured.<br>Open Settings to add some.</div>';
    return;
  }

  let html = '';
  const sorted = [...engines].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const engine of sorted) {
    const aliases = (engine.aliases || []).map(a => `@${a}`).join(', ');
    const keywords = `@${engine.keyword}${aliases ? ', ' + aliases : ''}`;
    const emoji = getEmojiForEngine(engine);

    html += `
      <div class="engine-item" data-id="${engine.id}">
        <div class="engine-icon">
          ${engine.icon
            ? `<img src="${engine.icon}" alt="${engine.name}" data-fallback="${emoji}">`
            : emoji
          }
        </div>
        <div class="engine-info">
          <div class="engine-name">${engine.name}</div>
          <div class="engine-keyword">${keywords}</div>
        </div>
        <label class="toggle" title="${engine.enabled ? 'Disable' : 'Enable'} ${engine.name}">
          <input type="checkbox" class="engine-toggle" data-id="${engine.id}" ${engine.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  container.innerHTML = html;

  // Attach icon fallback handlers without inline onerror= (blocked by MV3 CSP)
  container.querySelectorAll('img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      img.parentElement.textContent = img.dataset.fallback;
    });
  });

  // Update footer count
  document.getElementById('footer-count').textContent = `${enabled.length}/${engines.length} active`;

  // Bind toggle events
  container.querySelectorAll('.engine-toggle').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      const id = checkbox.dataset.id;
      const checked = checkbox.checked;

      const latest = await getSettings();
      if (!latest) return;
      latest.engines = latest.engines.map(e =>
        e.id === id ? { ...e, enabled: checked } : e
      );
      await saveSettings(latest);
    });
  });
}


async function init() {
  const settings = await getSettings();

  if (!settings) {
    document.getElementById('engine-list').innerHTML =
      '<div class="empty-state">No settings found.<br>Please open Settings to initialize.</div>';
    return;
  }

  // Update trigger hint
  const triggerKbd = document.getElementById('trigger-kbd');
  if (triggerKbd) triggerKbd.textContent = settings.triggerKeyword || 's';

  renderEngineList(settings);
}

// Open options page
document.getElementById('btn-open-settings')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
