/** Extension UI strings (not the translation feature). Phase 2+: load from locale files. */
export const uiStrings = {
  appName: 'LinguaLens',
  translate: 'Translate',
  pronouncing: 'Pronounce',
  saveToVocabulary: 'Save to vocabulary',
  comingSoon: 'Coming in Phase 2',
  simplify: 'Simplify',
  grammar: 'Grammar check',
  summarize: 'Summarize',
  rewrite: 'Rewrite',
  settings: 'Settings',
  history: 'History',
  searchHistory: 'Search history…',
  clearHistory: 'Clear history',
  noHistory: 'No translations yet. Select text on any page to get started.',
  loading: 'Translating…',
  offline: 'You are offline. Check your connection and try again.',
  apiFailure: 'Translation failed. Please try again.',
  unsupportedLanguage: 'This language is not supported.',
  rateLimited: 'Too many requests. Please wait a moment.',
  quotaExceeded:
    'Daily free translation limit reached — resets at midnight. Add your email in Settings for a higher limit.',
  quotaWarning: '≈ {count} words left today',
  missingApiKey: 'Add an API key in Settings to use a real translation provider.',
  sourceLanguage: 'From',
  targetLanguage: 'To',
  autoDetect: 'Auto-detect',
  openSettings: 'Open settings',
} as const;

export type UiStringKey = keyof typeof uiStrings;

export function t(key: UiStringKey): string {
  return uiStrings[key];
}

export function tQuotaWarning(wordsRemaining: number): string {
  return uiStrings.quotaWarning.replace('{count}', String(wordsRemaining));
}
