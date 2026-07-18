import type { UserSettings } from '@/types';

export const DEFAULT_SETTINGS: UserSettings = {
  targetLanguage: 'en',
  sourceLanguage: 'auto',
  popupBehavior: 'click-to-show',
  theme: 'system',
  myMemoryEmail: '',
  geminiApiKey: '',
  maxHistoryItems: 100,
  hinglishTranslationMode: 'auto',
  freeLLMApiKey: '',
  freeLLMBaseUrl: '',
};

export const STORAGE_KEYS = {
  settingsSync: 'lingualens_settings',
  historyLocal: 'lingualens_history',
  translationCache: 'lingualens_translation_cache',
  myMemoryEmail: 'lingualens_mymemory_email',
  geminiApiKey: 'lingualens_gemini_api_key',
  quotaUsage: 'lingualens_quota_usage',
  vocabularyLocal: 'lingualens_vocabulary',
  freeLLMApiKey: 'lingualens_freellm_api_key',
  freeLLMBaseUrl: 'lingualens_freellm_base_url',
} as const;

export const CACHE_MAX_ENTRIES = 200;
export const VOCABULARY_MAX_ENTRIES = 500;
