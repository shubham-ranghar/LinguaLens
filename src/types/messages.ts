import type {
  ApiError,
  HistoryEntry,
  TranslationRequest,
  TranslationResult,
  UserSettings,
  VocabularyEntry,
} from './index';
import type { QuotaStatus } from '@/lib/quota';
import type { RewriteTone, GrammarResult } from '@/lib/api/ai-features';

export type { RewriteTone, GrammarResult } from '@/lib/api/ai-features';

/** Messages sent TO the background service worker */
export type BackgroundRequest =
  | { type: 'TRANSLATE'; payload: TranslationRequest }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'GET_HISTORY'; payload?: { query?: string } }
  | { type: 'GET_QUOTA_STATUS' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'ADD_HISTORY'; payload: Omit<HistoryEntry, 'id' | 'timestamp'> }
  | { type: 'PING' }
  | { type: 'AI_SIMPLIFY'; payload: { text: string } }
  | { type: 'AI_CORRECT_GRAMMAR'; payload: { text: string } }
  | { type: 'AI_SUMMARIZE'; payload: { text: string } }
  | { type: 'AI_REWRITE'; payload: { text: string; tone: RewriteTone } }
  | { type: 'SAVE_VOCABULARY'; payload: Omit<VocabularyEntry, 'id' | 'savedAt'> }
  | { type: 'GET_VOCABULARY'; payload?: { query?: string; tagFilter?: string } }
  | { type: 'DELETE_VOCABULARY'; payload: { id: string } };

/** Responses FROM the background service worker */
export type BackgroundResponse =
  | { type: 'TRANSLATE_RESULT'; payload: TranslationResult }
  | { type: 'SETTINGS'; payload: UserSettings }
  | { type: 'SETTINGS_SAVED'; payload: UserSettings }
  | { type: 'HISTORY'; payload: HistoryEntry[] }
  | { type: 'QUOTA_STATUS'; payload: QuotaStatus }
  | { type: 'HISTORY_CLEARED' }
  | { type: 'HISTORY_ADDED'; payload: HistoryEntry }
  | { type: 'PONG' }
  | { type: 'ERROR'; payload: ApiError }
  | { type: 'AI_SIMPLIFY_RESULT'; payload: string }
  | { type: 'AI_CORRECT_GRAMMAR_RESULT'; payload: GrammarResult }
  | { type: 'AI_SUMMARIZE_RESULT'; payload: string }
  | { type: 'AI_REWRITE_RESULT'; payload: string }
  | { type: 'VOCABULARY_SAVED'; payload: VocabularyEntry }
  | { type: 'VOCABULARY'; payload: VocabularyEntry[] }
  | { type: 'VOCABULARY_DELETED' };

export type MessageResponse<T extends BackgroundResponse['type']> = Extract<
  BackgroundResponse,
  { type: T }
>;
