import {
  defaultTranslationProvider,
  createFallbackProvider,
  isTranslationError,
} from '@/lib/api/translation';
import { correctGrammar, rewrite, simplify, summarize } from '@/lib/api/ai-features';
import { addQuotaWords, countWords, getQuotaStatus } from '@/lib/quota';
import {
  addHistoryEntry,
  buildCacheKey,
  clearHistory,
  deleteVocabularyEntry,
  getSettings,
  getTranslationCache,
  saveSettings,
  saveVocabularyEntry,
  searchHistory,
  searchVocabulary,
  setTranslationCacheEntry,
} from '@/lib/storage';
import { resolveSourceLanguage } from '@/lib/utils';
import type { BackgroundRequest, BackgroundResponse } from '@/types/messages';

// Debouncing cache for in-flight requests to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<import('@/types').TranslationResult>>();

async function handleTranslate(
  payload: import('@/types').TranslationRequest,
): Promise<BackgroundResponse> {
  const settings = await getSettings();
  const requestedSource = payload.sourceLanguage ?? settings.sourceLanguage;
  const target = payload.targetLanguage || settings.targetLanguage;
  const cacheSource =
    requestedSource === 'auto'
      ? 'auto'
      : resolveSourceLanguage(requestedSource, payload.pageLanguage);
  const cacheKey = buildCacheKey(payload.text, cacheSource, target);

  // Check disk cache (persists across service worker restarts)
  const diskCache = await getTranslationCache();
  const diskHit = diskCache.find((c) => c.key === cacheKey);
  if (diskHit) {
    return { type: 'TRANSLATE_RESULT', payload: { ...diskHit.result, cached: true } };
  }

  // Debounce: check if this request is already in-flight
  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    const result = await existingRequest;
    return { type: 'TRANSLATE_RESULT', payload: { ...result, cached: false } };
  }

  // Create new request promise
  const requestPromise = (async () => {
    try {
      // Use fallback provider for resilience
      const provider = createFallbackProvider();
      const result = await provider.translate(
        { ...payload, sourceLanguage: requestedSource, targetLanguage: target },
        settings.myMemoryEmail || undefined,
      );

      // Cache to disk (persists across restarts)
      await setTranslationCacheEntry({ key: cacheKey, result, timestamp: Date.now() });
      await addQuotaWords(countWords(payload.text));

      return result;
    } finally {
      // Clean up in-flight cache after request completes
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    console.log('[Language Debug - Background] Sending result to frontend:', {
      detectedSourceLanguage: result.detectedSourceLanguage,
      targetLanguage: result.targetLanguage,
    });
    return { type: 'TRANSLATE_RESULT', payload: result };
  } catch (error) {
    if (isTranslationError(error)) {
      return { type: 'ERROR', payload: { code: error.code, message: error.message } };
    }
    return {
      type: 'ERROR',
      payload: {
        code: 'API_FAILURE',
        message: error instanceof Error ? error.message : 'Translation failed.',
      },
    };
  }
}

function handleAiError(error: unknown): BackgroundResponse {
  if (error instanceof Error) {
    if (error.message === 'MISSING_API_KEY') {
      return {
        type: 'ERROR',
        payload: { code: 'MISSING_API_KEY', message: 'Add your free Gemini API key in Settings.' },
      };
    }
    if (error.message === 'RATE_LIMITED') {
      return {
        type: 'ERROR',
        payload: { code: 'RATE_LIMITED', message: 'Free tier limit reached, try again shortly.' },
      };
    }
    if (error.message === 'TIMEOUT') {
      return {
        type: 'ERROR',
        payload: { code: 'API_FAILURE', message: 'Request timed out. Please try again.' },
      };
    }
  }
  return {
    type: 'ERROR',
    payload: { code: 'API_FAILURE', message: error instanceof Error ? error.message : 'AI request failed.' },
  };
}

async function handleMessage(message: BackgroundRequest): Promise<BackgroundResponse> {
  switch (message.type) {
    case 'PING':
      return { type: 'PONG' };

    case 'TRANSLATE':
      return handleTranslate(message.payload);

    case 'GET_QUOTA_STATUS': {
      const status = await getQuotaStatus();
      return { type: 'QUOTA_STATUS', payload: status };
    }

    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { type: 'SETTINGS', payload: settings };
    }

    case 'SAVE_SETTINGS': {
      const settings = await saveSettings(message.payload);
      return { type: 'SETTINGS_SAVED', payload: settings };
    }

    case 'GET_HISTORY': {
      const history = await searchHistory(message.payload?.query ?? '');
      return { type: 'HISTORY', payload: history };
    }

    case 'CLEAR_HISTORY':
      await clearHistory();
      return { type: 'HISTORY_CLEARED' };

    case 'ADD_HISTORY': {
      const settings = await getSettings();
      const entry = await addHistoryEntry(message.payload, settings.maxHistoryItems);
      return { type: 'HISTORY_ADDED', payload: entry };
    }

    case 'AI_SIMPLIFY': {
      const settings = await getSettings();
      const maskedKey = settings.geminiApiKey 
        ? `${settings.geminiApiKey.substring(0, 6)}...${settings.geminiApiKey.slice(-4)}`
        : 'MISSING';
      console.log('[DEBUG] AI_SIMPLIFY - Full settings object:', { ...settings, geminiApiKey: maskedKey });
      console.log('[DEBUG] AI_SIMPLIFY - API key length:', settings.geminiApiKey?.length ?? 0);
      try {
        const result = await simplify(message.payload.text, settings.geminiApiKey);
        return { type: 'AI_SIMPLIFY_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'AI_CORRECT_GRAMMAR': {
      const settings = await getSettings();
      const maskedKey = settings.geminiApiKey 
        ? `${settings.geminiApiKey.substring(0, 6)}...${settings.geminiApiKey.slice(-4)}`
        : 'MISSING';
      console.log('[DEBUG] AI_CORRECT_GRAMMAR - Full settings object:', { ...settings, geminiApiKey: maskedKey });
      console.log('[DEBUG] AI_CORRECT_GRAMMAR - API key length:', settings.geminiApiKey?.length ?? 0);
      try {
        const result = await correctGrammar(message.payload.text, settings.geminiApiKey);
        return { type: 'AI_CORRECT_GRAMMAR_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'AI_SUMMARIZE': {
      const settings = await getSettings();
      const maskedKey = settings.geminiApiKey 
        ? `${settings.geminiApiKey.substring(0, 6)}...${settings.geminiApiKey.slice(-4)}`
        : 'MISSING';
      console.log('[DEBUG] AI_SUMMARIZE - Full settings object:', { ...settings, geminiApiKey: maskedKey });
      console.log('[DEBUG] AI_SUMMARIZE - API key length:', settings.geminiApiKey?.length ?? 0);
      try {
        const result = await summarize(message.payload.text, settings.geminiApiKey);
        return { type: 'AI_SUMMARIZE_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'AI_REWRITE': {
      const settings = await getSettings();
      const maskedKey = settings.geminiApiKey 
        ? `${settings.geminiApiKey.substring(0, 6)}...${settings.geminiApiKey.slice(-4)}`
        : 'MISSING';
      console.log('[DEBUG] AI_REWRITE - Full settings object:', { ...settings, geminiApiKey: maskedKey });
      console.log('[DEBUG] AI_REWRITE - API key length:', settings.geminiApiKey?.length ?? 0);
      try {
        const result = await rewrite(message.payload.text, message.payload.tone, settings.geminiApiKey);
        return { type: 'AI_REWRITE_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'SAVE_VOCABULARY': {
      const entry = await saveVocabularyEntry(message.payload);
      return { type: 'VOCABULARY_SAVED', payload: entry };
    }

    case 'GET_VOCABULARY': {
      const vocabulary = await searchVocabulary(
        message.payload?.query ?? '',
        message.payload?.tagFilter,
      );
      return { type: 'VOCABULARY', payload: vocabulary };
    }

    case 'DELETE_VOCABULARY': {
      await deleteVocabularyEntry(message.payload.id);
      return { type: 'VOCABULARY_DELETED' };
    }

    default:
      return {
        type: 'ERROR',
        payload: { code: 'UNKNOWN' as const, message: 'Unknown message type' },
      };
  }
}

// DEBUG FUNCTION: Call this from service worker console to clear ALL stored settings
// Usage: await clearAllStorage()
export async function clearAllStorage(): Promise<void> {
  await chrome.storage.local.clear();
  console.log('[DEBUG] All storage cleared successfully');
}

export function initBackground(): void {
  chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          type: 'ERROR',
          payload: {
            code: 'UNKNOWN',
            message: error instanceof Error ? error.message : 'Unexpected error.',
          },
        } satisfies BackgroundResponse);
      });
    return true;
  });

  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'translate-selection') return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_TRANSLATE' });
  });
}
