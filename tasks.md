# Tasks — SearchShift Extension

> Work top-to-bottom. Each task builds on the previous. Complete all items in a phase before moving to the next.

---

## Phase 0 — Project Scaffold

- [ ] **T-001** Init WXT project: `npx wxt@latest init searchshift` → choose React + TypeScript template
- [ ] **T-002** Install dependencies: `tailwindcss`, `uuid`, `zod` (schema validation for import)
- [ ] **T-003** Configure `wxt.config.ts`:
  - Set `manifest.omnibox.keyword` to `"s"`
  - Add permissions: `omnibox`, `storage`, `contextMenus`, `activeTab`
  - Set extension name, version, description
- [ ] **T-004** Create folder structure as per implementation plan (`lib/`, `types/`, `entrypoints/`)
- [ ] **T-005** Create `types/index.ts` — define `SearchEngine` and `Settings` interfaces
- [ ] **T-006** Add placeholder icons (16/32/48/128px) to `public/icons/`

---

## Phase 1 — Storage & Data Layer

- [ ] **T-007** Create `lib/defaults.ts` — define the 7 default engines (Google, Bing, DDG, Perplexity, Brave, YouTube, Wikipedia) with all fields populated
- [ ] **T-008** Create `lib/storage.ts`:
  - `getSettings(): Promise<Settings>` — reads from `chrome.storage.sync`, merges with defaults if first run
  - `saveSettings(settings: Settings): Promise<void>`
  - `getEngines(): Promise<SearchEngine[]>` — convenience wrapper
  - `saveEngines(engines: SearchEngine[]): Promise<void>`
- [ ] **T-009** Write unit-testable pure functions in `lib/engines.ts`:
  - `findEngineByKeyword(engines, keyword): SearchEngine | null`
  - `validateEngine(engine): ValidationResult` — checks keyword uniqueness, URL contains `%s`, etc.
  - `addEngine(engines, newEngine): SearchEngine[]`
  - `updateEngine(engines, id, patch): SearchEngine[]`
  - `deleteEngine(engines, id): SearchEngine[]` — reject if default engine
  - `reorderEngines(engines, fromIndex, toIndex): SearchEngine[]`

---

## Phase 2 — Core Omnibox Logic

- [ ] **T-010** Create `lib/omnibox.ts` — `parseQuery(input)` function:
  - Regex extract `@keyword` from anywhere in string
  - Return `{ query: string, engineKeyword: string | null }`
  - Handle edge cases: `@@`, `@` alone, multiple `@` tags (use first match)
- [ ] **T-011** Create `lib/suggestions.ts` — `fetchSuggestions(engine, query)`:
  - Fetch from `engine.suggestionsUrl.replace('%s', encodeURIComponent(query))`
  - Parse OpenSearch suggestion format: `[query, [suggestion1, suggestion2, ...]]`
  - Return `string[]`, max 3 results
  - Wrap in `try/catch` — return `[]` on any failure (network, parse, CORS)
  - Add 400ms debounce signal support (pass `AbortSignal`)
- [ ] **T-012** Create `entrypoints/background.ts` — register omnibox handlers:
  - `browser.omnibox.onInputChanged` → call `parseQuery`, fetch suggestions, call `browser.omnibox.suggest`
  - `browser.omnibox.onInputEntered` → call `parseQuery`, resolve engine, open correct URL
  - `browser.omnibox.setDefaultSuggestion` → set helpful hint text on activation
- [ ] **T-013** Implement **multi-engine suggestion mode** (no @tag):
  - Fetch from all enabled engines with `suggestionsUrl` in parallel (`Promise.allSettled`)
  - Prefix each result: `[EngineName] suggestion text`
  - Interleave results (1 from each engine, round-robin) rather than grouping — feels more natural
  - Cap total at 6 suggestions
- [ ] **T-014** Implement **single-engine suggestion mode** (@tag matched):
  - Fetch only from matched engine
  - No prefix — put engine name in `description` field of suggestion
  - Default suggestion shows `Search [EngineName] for "query"`
- [ ] **T-015** Implement **fallback** when @keyword not found:
  - Show suggestion: `⚠ Unknown engine "@xyz" — press Enter to search with default`
  - On Enter, strip the bad @tag, search with default engine
- [ ] **T-016** Implement **prefix-based classic omnibox mode** (optional setting):
  - In `onInputChanged`, detect if input starts with a known engine keyword + space (e.g. `ddg `)
  - If `omniboxModeEnabled` is true AND that engine has `omniboxMode: true` → treat as single-engine mode
  - This simulates the classic `ddg` + Tab behavior within the `s`-mode omnibox

---

## Phase 3 — Context Menu

- [ ] **T-017** In `background.ts`, on extension install/startup:
  - Call `browser.contextMenus.removeAll()` then rebuild
  - Create parent item: `"Search with..."` on `selection` context
  - Create child item per enabled engine
- [ ] **T-018** Listen to `browser.storage.onChanged` in background — rebuild context menu whenever engines list changes
- [ ] **T-019** `browser.contextMenus.onClicked` handler:
  - Get `info.selectionText`
  - Match `menuItemId` to engine id
  - Open `engine.searchUrl.replace('%s', encodeURIComponent(selectionText))` in new tab

---

## Phase 4 — Options Page

- [ ] **T-020** Scaffold `entrypoints/options/App.tsx` with tab navigation: **Engines | Settings | Backup**
- [ ] **T-021** Build **Engines tab** — engine list:
  - Render each engine as a card/row: Name, Keyword badge, Omnibox toggle, Enabled toggle, Edit/Delete buttons
  - Default engines show a lock icon instead of Delete
  - Drag-to-reorder (use `@dnd-kit/sortable` or simple up/down arrows to keep it simple)
- [ ] **T-022** Build **Add/Edit Engine modal**:
  - Fields: Name, Keyword, Search URL, Suggestions URL (optional), Omnibox Mode toggle
  - Inline validation on each field (keyword uniqueness, URL format, `%s` presence)
  - Save → calls `addEngine` or `updateEngine`, persists via `saveEngines`
- [ ] **T-023** Build **Settings tab**:
  - Omnibox trigger keyword input (with warning: "Changing this requires reloading the extension")
  - Toggle: Enable @tag parsing
  - Toggle: Enable classic omnibox mode globally
  - Slider/select: Max suggestions per engine (1, 2, 3)
  - Toggle: Show multi-engine suggestions when no @tag
- [ ] **T-024** Build **Backup tab**:
  - **Export button** → serialize `Settings` to JSON → trigger download as `searchshift-backup-YYYY-MM-DD.json`
  - **Import button** → file input (`.json`) → read → validate with `zod` schema → apply or show error
  - **Reset to Defaults button** → confirm dialog → wipe `chrome.storage.sync` → reload defaults

---

## Phase 5 — Popup

- [ ] **T-025** Build `entrypoints/popup/App.tsx`:
  - Header: Extension name + "Open Settings" link
  - Engine list: name, `@keyword` badge, enabled toggle
  - Toggling here updates `chrome.storage.sync` immediately
  - Footer: current omnibox trigger shown as reminder e.g. `Trigger: s + Tab`

---

## Phase 6 — Backup & Restore Logic

- [ ] **T-026** Create `lib/backup.ts`:
  - `exportBackup(settings): string` → `JSON.stringify` with 2-space indent
  - `importBackup(jsonString): Settings | ValidationError` → parse + zod validate
  - Define `backupSchema` in zod matching `Settings` interface exactly
  - On validation error, return field-level error messages for display in UI

---

## Phase 7 — Polish & Edge Cases

- [ ] **T-027** Add debounce (400ms) to omnibox `onInputChanged` to avoid hammering suggestion APIs on every keystroke — use `AbortController` to cancel in-flight fetches
- [ ] **T-028** Handle CORS on suggestion fetches — some engines (Perplexity, Brave) don't expose a public suggestions API; show a note in the Add Engine form if `suggestionsUrl` is left empty
- [ ] **T-029** Persist omnibox trigger keyword change flow:
  - Save new keyword to storage
  - Show banner: "Reload extension for trigger change to take effect" with a **Reload** button
  - Reload button calls `chrome.runtime.reload()`
- [ ] **T-030** First-run experience:
  - On `browser.runtime.onInstalled` with `reason === 'install'` → open options page automatically
  - Pre-populate with default engines
- [ ] **T-031** Add keyword conflict detection across all engines — surface as warning in options page if two engines share a keyword
- [ ] **T-032** Test all flows in Edge (primary target) and Chrome (secondary)

---

## Phase 8 — Build & Package

- [ ] **T-033** Run `wxt build` → verify no TS errors
- [ ] **T-034** Run `wxt zip` → produces installable `.zip` for Edge Add-ons or manual install
- [ ] **T-035** Test manual install via `edge://extensions` → Developer mode → Load unpacked
- [ ] **T-036** Verify omnibox trigger works, @tag parsing works, context menu appears, options page saves/loads correctly, backup export/import round-trips cleanly

---

## Task Summary

| Phase | Tasks | Focus |
|---|---|---|
| 0 | T-001 → T-006 | Scaffold |
| 1 | T-007 → T-009 | Storage & data |
| 2 | T-010 → T-016 | Omnibox core |
| 3 | T-017 → T-019 | Context menu |
| 4 | T-020 → T-024 | Options page |
| 5 | T-025 | Popup |
| 6 | T-026 | Backup logic |
| 7 | T-027 → T-032 | Polish |
| 8 | T-033 → T-036 | Build & test |

**Total: 36 tasks across 8 phases**
