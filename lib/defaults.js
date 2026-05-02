// Default search engines shipped with the extension

export const DEFAULT_ENGINES = [
  {
    id: 'google',
    name: 'Google',
    keyword: 'google',
    aliases: ['g'],
    searchUrl: 'https://www.google.com/search?q=%s',
    suggestionsUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s',
    icon: 'https://www.google.com/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 0
  },
  {
    id: 'bing',
    name: 'Bing',
    keyword: 'bing',
    aliases: ['b'],
    searchUrl: 'https://www.bing.com/search?q=%s',
    suggestionsUrl: 'https://api.bing.com/osjson.aspx?query=%s',
    icon: 'https://www.bing.com/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 1
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    keyword: 'ddg',
    aliases: ['d'],
    searchUrl: 'https://duckduckgo.com/?q=%s',
    suggestionsUrl: 'https://duckduckgo.com/ac/?q=%s&type=list',
    icon: 'https://duckduckgo.com/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 2
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    keyword: 'perplexity',
    aliases: ['p'],
    searchUrl: 'https://www.perplexity.ai/search?q=%s',
    suggestionsUrl: '',
    icon: 'https://www.perplexity.ai/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 3
  },
  {
    id: 'brave',
    name: 'Brave Search',
    keyword: 'brave',
    aliases: [],
    searchUrl: 'https://search.brave.com/search?q=%s',
    suggestionsUrl: '',
    icon: 'https://brave.com/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 4
  },
  {
    id: 'youtube',
    name: 'YouTube',
    keyword: 'yt',
    aliases: [],
    searchUrl: 'https://www.youtube.com/results?search_query=%s',
    suggestionsUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=%s',
    icon: 'https://www.youtube.com/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 5
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    keyword: 'wiki',
    aliases: ['w'],
    searchUrl: 'https://en.wikipedia.org/w/index.php?search=%s',
    suggestionsUrl: 'https://en.wikipedia.org/w/api.php?action=opensearch&search=%s&limit=5&format=json&origin=*',
    icon: 'https://www.wikipedia.org/favicon.ico',
    omniboxMode: false,
    showInSuggestions: true,
    enabled: true,
    isDefault: true,
    order: 6
  }
];

export const DEFAULT_SETTINGS = {
  engines: DEFAULT_ENGINES,
  triggerKeyword: 's',
  atTagEnabled: true,
  omniboxModeEnabled: false,
  showSuggestionsFromAll: true,
  maxSuggestionsPerEngine: 2,
  defaultEngineId: 'google'
};
