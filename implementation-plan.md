# Implementation Plan — SearchShift Extension

## Overview

**SearchShift** is a WXT-based browser extension for Edge (and Chromium browsers) that enables flexible, per-query search engine switching via:
- `@keyword` tag anywhere in an omnibox query (primary mode)
- Optional per-engine classic omnibox takeover (secondary mode)
- Right-click context menu reruns (bonus)
- Full backup/restore and custom engine management

---

## Architecture

### Tech Stack
- **Framework:** WXT (latest)
- **Language:** TypeScript
- **UI:** React + Tailwind (options page, popup)
- **Storage:** `chrome.storage.sync` (settings, engines) + `chrome.storage.local` (backup blobs)
- **Manifest:** V3

### Entry Points (WXT convention)

```
entrypoints/
  background.ts          # Service worker — omnibox logic, message routing
  options/               # Full settings page (engines, backup/restore)
    index.html
    App.tsx
  popup/                 # Toolbar button — quick engine toggle preview
    index.html
    App.tsx
```

### Supporting Modules

```
lib/
  engines.ts             # Engine schema, CRUD, defaults
  omnibox.ts             # Omnibox event handlers, @tag parser, suggestion builder
  suggestions.ts         # Fetch suggestions from engines' suggestion URLs
  backup.ts              # Export/import JSON logic
  storage.ts             # Typed wrappers around chrome.storage
```

---

## Data Model

### Engine Schema

```ts
interface SearchEngine {
  id: string;               // uuid
  name: string;             // "Perplexity"
  keyword: string;          // "perplexity" — used for @perplexity matching
  searchUrl: string;        // "https://www.perplexity.ai/search?q=%s"
  suggestionsUrl?: string;  // "https://suggest.example.com/?q=%s" (optional)
  icon?: string;            // base64 favicon or URL
  omniboxMode: boolean;     // enable classic omnibox takeover for this engine
  enabled: boolean;
  order: number;            // display/suggestion order
}
```

### Settings Schema

```ts
interface Settings {
  engines: SearchEngine[];
  triggerKeyword: string;      // default "s" — the omnibox trigger
  atTagEnabled: boolean;       // enable @keyword parsing (default true)
  omniboxModeEnabled: boolean; // global toggle for classic omnibox mode
  showSuggestionsFromAll: boolean; // show results from multiple engines
  maxSuggestionsPerEngine: number; // default 2
}
```

---

## Feature 1 — Omnibox with @tag Parsing (Primary)

### How it works

1. User types `s` + **Tab** in Edge address bar → extension owns the omnibox
2. User types query freely, e.g.:
   - `best headphones @google`
   - `@ddg best headphones`
   - `best @perplexity headphones`
3. Background service worker:
   - Parses input to extract `@keyword` tag (regex: `@(\w+)`)
   - Strips the tag from the display query
   - Looks up matching engine by keyword
   - If matched → shows suggestions from **that engine only**
   - If no `@tag` → shows suggestions from **all enabled engines**, grouped by engine label prefix `[EngineName]`
4. User selects a suggestion → navigates to that engine's search URL with clean query

### @tag Parser Logic

```ts
function parseQuery(input: string): { query: string; engineKeyword: string | null } {
  const match = input.match(/@(\w+)/);
  if (!match) return { query: input.trim(), engineKeyword: null };
  return {
    query: input.replace(match[0], '').trim(),
    engineKeyword: match[1].toLowerCase()
  };
}
```

### Suggestion Building (no @tag → multi-engine)

- Fetch suggestions from each enabled engine's `suggestionsUrl` in parallel
- Prefix each result: `[Google] best headphones reviews`
- Cap per engine via `maxSuggestionsPerEngine` setting
- Total omnibox suggestions capped at 6 (Chrome/Edge limit)

### Suggestion Building (with @tag → single engine)

- Fetch from matched engine's `suggestionsUrl` only
- No prefix needed — description field shows engine name
- Falls back to showing the raw query as a single suggestion if no `suggestionsUrl`

---

## Feature 2 — Classic Omnibox Mode (Optional, Per Engine)

### How it works

When `omniboxMode: true` on an engine AND `omniboxModeEnabled: true` globally:

- That engine's `keyword` is **also registered** as a standalone omnibox trigger
- User can type `ddg` + **Tab** → DuckDuckGo omnibox mode activates directly
- Suggestions come exclusively from DuckDuckGo's suggestion URL
- This is in **addition** to the `s` + Tab @tag flow — both work simultaneously

### Implementation Note

WXT's `defineBackground` + `browser.omnibox` API only supports **one** `browser.omnibox.setDefaultSuggestion` at a time and one keyword declared in `manifest.json`. Classic per-engine omnibox mode is therefore simulated by:

- Detecting the typed prefix in the `s`-mode omnibox input (e.g. user types `ddg ` without @)
- Treating a bare short prefix match as an implicit engine switch

**True** separate omnibox keywords per engine require separate extension entries — not feasible in one extension. So classic mode = smart prefix detection within the single omnibox trigger.

---

## Feature 3 — Context Menu (Bonus)

- Registered on `selection` context
- On any page, select text → right-click → **"Search with..."** submenu
- Submenu lists all enabled engines
- Clicking one opens `engine.searchUrl.replace('%s', selectedText)` in a new tab

---

## Feature 4 — Options Page

### Sections

#### 4.1 Search Engines List
- Table/card list of all engines (default + custom)
- Columns: Name, Keyword, Suggestions URL, Omnibox Mode toggle, Enabled toggle, Order (drag handle), Actions (Edit / Delete)
- **Add Engine** button → inline form or modal:
  - Name
  - Keyword (validated: lowercase, no spaces, unique)
  - Search URL (validated: contains `%s`)
  - Suggestions URL (optional, validated if provided)
  - Omnibox Mode toggle
- Default engines cannot be deleted, only disabled

#### 4.2 Global Settings
- Omnibox trigger keyword (default: `s`)
- Enable/disable @tag parsing
- Enable/disable classic omnibox mode globally
- Max suggestions per engine (1–3)
- Show suggestions from all engines when no @tag

#### 4.3 Backup & Restore
- **Export** → downloads `searchshift-backup-{date}.json` containing full `Settings` object
- **Import** → file picker, validates JSON schema before applying
- **Reset to Defaults** → restores factory engine list, keeps no custom engines

---

## Feature 5 — Popup (Toolbar Button)

Lightweight — not a full settings page:
- Shows list of enabled engines with their keywords
- Quick toggle per engine (enabled/disabled)
- "Open Settings" link
- Useful as a reference card for your configured @keywords

---

## Default Engines (Shipped with Extension)

| Name | Keyword | Has Suggestions |
|---|---|---|
| Google | `google` / `g` | ✅ |
| Bing | `bing` / `b` | ✅ |
| DuckDuckGo | `ddg` / `d` | ✅ |
| Perplexity | `perplexity` / `p` | ❌ (no public API) |
| Brave Search | `brave` | ❌ |
| YouTube | `yt` | ✅ |
| Wikipedia | `wiki` / `w` | ✅ |

---

## Permissions (manifest.json)

```json
{
  "permissions": [
    "omnibox",
    "storage",
    "contextMenus",
    "activeTab",
    "scripting"
  ],
  "omnibox": {
    "keyword": "s"
  }
}
```

---

## Edge Cases & Constraints

| Scenario | Handling |
|---|---|
| `@keyword` matches nothing | Fall back to default engine, show warning suggestion |
| `suggestionsUrl` fetch fails | Silently skip, show raw query suggestion for that engine |
| Two engines share same keyword | Validation prevents this on save |
| User changes omnibox trigger keyword | Requires extension reload (manifest constraint) — warn user |
| Import JSON is malformed/missing fields | Schema validate, reject with error message, no partial apply |
| Offline | Suggestions silently fail, query still routes correctly |

---

## File Structure (Final)

```
searchshift/
├── wxt.config.ts
├── package.json
├── tsconfig.json
├── public/
│   └── icons/           # 16, 32, 48, 128px icons
├── entrypoints/
│   ├── background.ts
│   ├── options/
│   │   ├── index.html
│   │   └── App.tsx
│   └── popup/
│       ├── index.html
│       └── App.tsx
├── lib/
│   ├── engines.ts
│   ├── omnibox.ts
│   ├── suggestions.ts
│   ├── backup.ts
│   ├── storage.ts
│   └── defaults.ts
└── types/
    └── index.ts
```
