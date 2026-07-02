export type PopupBehavior = 'click-to-show' | 'auto-show';
export type Theme = 'light' | 'dark' | 'system';

export interface UserSettings {
  targetLanguage: string;
  sourceLanguage: string;
  popupBehavior: PopupBehavior;
  theme: Theme;
  myMemoryEmail: string;
  geminiApiKey: string;
  maxHistoryItems: number;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  /** Page/browser language hint when sourceLanguage is `auto`. */
  pageLanguage?: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage: string | null;
  targetLanguage: string;
  provider: string;
  cached: boolean;
  partOfSpeech?: string | null;
  definition?: string | null;
  synonyms?: string[];
  antonyms?: string[];
  exampleSentences?: string[];
}

export interface HistoryEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  url: string;
}

export interface VocabularyEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  definition?: string | null;
  synonyms?: string[];
  savedAt: number;
  tags: string[];
}

export type TranslationErrorCode =
  | 'OFFLINE'
  | 'API_FAILURE'
  | 'UNSUPPORTED_LANGUAGE'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'MISSING_API_KEY'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ApiError {
  code: TranslationErrorCode;
  message: string;
}
