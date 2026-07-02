import type { UserSettings, VocabularyEntry } from '@/types';
import type { BackgroundRequest, BackgroundResponse, RewriteTone } from '@/types/messages';

export type { BackgroundRequest, BackgroundResponse, RewriteTone };

export async function sendToBackground<T extends BackgroundResponse['type']>(
  message: BackgroundRequest,
  expectedType: T,
): Promise<Extract<BackgroundResponse, { type: T }>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as BackgroundResponse | undefined;

    if (!response) {
      throw new Error('No response from background service worker.');
    }

    if (response.type === 'ERROR') {
      throw new BackgroundError(response.payload.code, response.payload.message);
    }

    if (response.type !== expectedType) {
      throw new Error(`Unexpected response type: ${response.type}`);
    }

    if (expectedType === 'TRANSLATE_RESULT') {
      console.log('[Language Debug - Messaging] Received TRANSLATE_RESULT:', {
        detectedSourceLanguage: (response as any).payload?.detectedSourceLanguage,
        targetLanguage: (response as any).payload?.targetLanguage,
      });
    }

    return response as Extract<BackgroundResponse, { type: T }>;
  } catch (error) {
    // Handle service worker restart and context invalidation errors
    if (error instanceof Error) {
      if (error.message.includes('Receiving end does not exist') ||
          error.message.includes('Extension context invalidated')) {
        throw new BackgroundError('SERVICE_WORKER_RESTART', 'Extension was reloaded. Please refresh the page and try again.');
      }
    }
    throw error;
  }
}

export class BackgroundError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BackgroundError';
  }
}

export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
) {
  return sendToBackground(
    {
      type: 'TRANSLATE',
      payload: { text, targetLanguage, sourceLanguage },
    },
    'TRANSLATE_RESULT',
  );
}

export async function fetchSettings() {
  return sendToBackground({ type: 'GET_SETTINGS' }, 'SETTINGS');
}

export async function updateSettings(partial: Partial<UserSettings>) {
  return sendToBackground({ type: 'SAVE_SETTINGS', payload: partial }, 'SETTINGS_SAVED');
}

export async function fetchHistory(query?: string) {
  return sendToBackground({ type: 'GET_HISTORY', payload: { query } }, 'HISTORY');
}

export async function clearHistory() {
  return sendToBackground({ type: 'CLEAR_HISTORY' }, 'HISTORY_CLEARED');
}

export async function fetchQuotaStatus() {
  return sendToBackground({ type: 'GET_QUOTA_STATUS' }, 'QUOTA_STATUS');
}

export async function fetchAiSimplify(text: string) {
  return sendToBackground({ type: 'AI_SIMPLIFY', payload: { text } }, 'AI_SIMPLIFY_RESULT');
}

export async function fetchAiCorrectGrammar(text: string) {
  return sendToBackground({ type: 'AI_CORRECT_GRAMMAR', payload: { text } }, 'AI_CORRECT_GRAMMAR_RESULT');
}

export async function fetchAiSummarize(text: string) {
  return sendToBackground({ type: 'AI_SUMMARIZE', payload: { text } }, 'AI_SUMMARIZE_RESULT');
}

export async function fetchAiRewrite(text: string, tone: RewriteTone) {
  return sendToBackground({ type: 'AI_REWRITE', payload: { text, tone } }, 'AI_REWRITE_RESULT');
}

export async function saveVocabulary(entry: Omit<VocabularyEntry, 'id' | 'savedAt'>) {
  return sendToBackground({ type: 'SAVE_VOCABULARY', payload: entry }, 'VOCABULARY_SAVED');
}

export async function fetchVocabulary(query?: string, tagFilter?: string) {
  return sendToBackground({ type: 'GET_VOCABULARY', payload: { query, tagFilter } }, 'VOCABULARY');
}

export async function deleteVocabulary(id: string) {
  return sendToBackground({ type: 'DELETE_VOCABULARY', payload: { id } }, 'VOCABULARY_DELETED');
}
