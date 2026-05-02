/**
 * SearchShift TypeScript type definitions.
 * These are used as documentation/reference for the JS code.
 */

/**
 * A search engine configuration.
 */
export interface SearchEngine {
  id: string;               // Unique identifier (uuid or slug)
  name: string;             // Display name e.g. "Perplexity"
  keyword: string;          // Primary @keyword e.g. "perplexity"
  aliases?: string[];       // Alternate keywords e.g. ["p"]
  searchUrl: string;        // URL with %s placeholder
  suggestionsUrl?: string;  // OpenSearch suggestions URL with %s (optional)
  icon?: string;            // Favicon URL or base64 data URI
  omniboxMode: boolean;     // Enable classic prefix mode for this engine
  enabled: boolean;
  isDefault?: boolean;      // Cannot be deleted, only disabled
  order: number;            // Display order
}

/**
 * Full settings object stored in chrome.storage.sync.
 */
export interface Settings {
  engines: SearchEngine[];
  triggerKeyword: string;           // Omnibox keyword, default "s"
  atTagEnabled: boolean;            // Enable @keyword parsing
  omniboxModeEnabled: boolean;      // Enable classic prefix mode globally
  showSuggestionsFromAll: boolean;  // Show multi-engine suggestions
  maxSuggestionsPerEngine: number;  // 1–3
  defaultEngineId: string;          // ID of the default/fallback engine
}

/**
 * Parsed query result from the @tag parser.
 */
export interface ParsedQuery {
  query: string;
  engineKeyword: string | null;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Backup import result.
 */
export type BackupResult =
  | { settings: Settings }
  | { error: string };
