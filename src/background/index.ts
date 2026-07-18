import {
  createFallbackProvider,
  isTranslationError,
} from '@/lib/api/translation';
import { correctGrammar, polishTranslation, rewrite, simplify, summarize, translateWithAI } from '@/lib/api/ai-features';
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
import { logger } from '@/lib/logger';

// Debouncing cache for in-flight requests to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<import('@/types').TranslationResult>>();

// Debug logging to storage for reliable debugging
interface DebugLogEntry {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

async function addDebugLog(event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const result = await chrome.storage.local.get('debugLogs') as { debugLogs?: DebugLogEntry[] };
    const logs: DebugLogEntry[] = result.debugLogs || [];
    logs.push({
      timestamp: new Date().toISOString(),
      event,
      data,
    });
    // Keep only last 50 log entries to prevent storage bloat
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50);
    }
    await chrome.storage.local.set({ debugLogs: logs });
  } catch (error) {
    // Silently fail if storage logging fails
    console.error('Failed to write debug log:', error);
  }
}

// Helper function to detect if text contains non-Latin script characters
function hasNonLatinScript(text: string): boolean {
  // Check for Devanagari (Hindi), Arabic, CJK (Chinese/Japanese/Korean), Cyrillic (Russian), etc.
  const nonLatinRanges: [number, number][] = [
    [0x0900, 0x097F], // Devanagari
    [0x0600, 0x06FF], // Arabic
    [0x4E00, 0x9FFF], // CJK Unified Ideographs
    [0x0400, 0x04FF], // Cyrillic
    [0xAC00, 0xD7AF], // Hangul (Korean)
    [0x0590, 0x05FF], // Hebrew
    [0x0370, 0x03FF], // Greek
    [0x0E00, 0x0E7F], // Thai
  ];
  
  for (const [start, end] of nonLatinRanges) {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= start && code <= end) {
        return true;
      }
    }
  }
  return false;
}

// Helper function to detect silent translation failures (when translation returns same text)
function isSilentFailure(originalText: string, translatedText: string, targetLang?: string): boolean {
  const normalizedOriginal = originalText.trim().toLowerCase();
  const normalizedTranslated = translatedText.trim().toLowerCase();
  
  // Exact match after normalization
  if (normalizedOriginal === normalizedTranslated) {
    console.log('isSilentFailure: exact match detected');
    return true;
  }
  
  // Near-identical check: if 90% or more of characters are the same
  const maxLength = Math.max(normalizedOriginal.length, normalizedTranslated.length);
  if (maxLength === 0) return false;
  
  let matches = 0;
  for (let i = 0; i < Math.min(normalizedOriginal.length, normalizedTranslated.length); i++) {
    if (normalizedOriginal[i] === normalizedTranslated[i]) {
      matches++;
    }
  }
  
  const similarity = matches / maxLength;
  if (similarity >= 0.9) {
    console.log('isSilentFailure: 90%+ similarity detected', { similarity });
    return true;
  }
  
  // Script mismatch detection: if target language requires non-Latin script but translation is still Latin
  if (targetLang) {
    const nonLatinTargetLangs = ['hi', 'ar', 'zh', 'ja', 'ko', 'ru', 'he', 'th', 'el'];
    if (nonLatinTargetLangs.includes(targetLang)) {
      const hasTargetScript = hasNonLatinScript(translatedText);
      if (!hasTargetScript) {
        console.log('isSilentFailure: script mismatch detected', { 
          targetLang, 
          hasTargetScript, 
          translatedPreview: translatedText.substring(0, 50) 
        });
        return true;
      }
    }
  }
  
  return false;
}

async function handleTranslate(
  payload: import('@/types').TranslationRequest,
): Promise<BackgroundResponse> {
  console.log('handleTranslate called with text length:', payload.text.length);
  await addDebugLog('handleTranslate-called', { textLength: payload.text.length });
  const settings = await getSettings();
  await addDebugLog('settings-loaded', { hasApiKey: !!settings.freeLLMApiKey });
  const requestedSource = payload.sourceLanguage ?? settings.sourceLanguage;
  const target = payload.targetLanguage || settings.targetLanguage;
  console.log('Requested target:', payload.targetLanguage, 'Settings target:', settings.targetLanguage, 'Final target used:', target);
  const cacheSource =
    requestedSource === 'auto'
      ? 'auto'
      : resolveSourceLanguage(requestedSource, payload.pageLanguage);
  const cacheKey = buildCacheKey(payload.text, cacheSource, target);

  // Check disk cache (persists across service worker restarts)
  const diskCache = await getTranslationCache();
  const diskHit = diskCache.find((c) => c.key === cacheKey);
  if (diskHit) {
    console.log('Translation found in disk cache, returning cached result');
    await addDebugLog('disk-cache-hit', { cached: true });
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
    let translationMethod = 'primary';
    try {
      // Use fallback provider for resilience
      const provider = createFallbackProvider();
      let result = await provider.translate(
        { ...payload, sourceLanguage: requestedSource, targetLanguage: target },
        settings.myMemoryEmail || undefined,
        settings,
      );

      // Check for silent failure (translation returns same/near-identical text)
      console.log('Checking isSilentFailure for:', payload.text.substring(0, 50), '->', result.translatedText.substring(0, 50));
      const silentFailure = isSilentFailure(payload.text, result.translatedText, target);
      console.log('isSilentFailure result:', silentFailure);
      await addDebugLog('silent-failure-check', { 
        isSilentFailure: silentFailure,
        originalPreview: payload.text.substring(0, 50),
        translatedPreview: result.translatedText.substring(0, 50)
      });
      if (silentFailure) {
        logger.warn('background', { 
          action: 'silent-failure-detected',
          originalText: payload.text.substring(0, 100),
          translatedText: result.translatedText.substring(0, 100),
        });
        
        // Attempt AI fallback if user has FreeLLMAPI key configured
        await addDebugLog('ai-fallback-check', { hasApiKey: !!settings.freeLLMApiKey });
        if (settings.freeLLMApiKey) {
          try {
            await addDebugLog('ai-fallback-attempted', { targetLanguage: target });
            logger.info('background', { action: 'attempting-ai-fallback' });
            const aiTranslation = await translateWithAI(payload.text, target);
            result = { ...result, translatedText: aiTranslation };
            translationMethod = 'ai-fallback';
            await addDebugLog('ai-fallback-success', { 
              translatedPreview: aiTranslation.substring(0, 100) 
            });
            logger.info('background', { action: 'ai-fallback-success', method: translationMethod });
          } catch (aiError) {
            // Log AI fallback failure but still return the original (failed) translation
            await addDebugLog('ai-fallback-failed', { 
              error: aiError instanceof Error ? aiError.message : String(aiError) 
            });
            logger.warn('background', { 
              action: 'ai-fallback-failed',
              error: aiError instanceof Error ? aiError.message : String(aiError) 
            });
          }
        } else {
          await addDebugLog('ai-fallback-skipped', { reason: 'no-api-key' });
        }
      }

      // Apply AI polish if enabled (only if not already using AI fallback)
      if (settings.aiEnhancedTranslation && settings.freeLLMApiKey && translationMethod !== 'ai-fallback') {
        try {
          const polishedText = await polishTranslation(result.translatedText, target);
          result = { ...result, translatedText: polishedText };
        } catch (polishError) {
          // Silently fall back to original translation if polish fails
          logger.warn('background', { 
            action: 'polish-failed', 
            error: polishError instanceof Error ? polishError.message : String(polishError) 
          });
        }
      }

      // Log which translation method was used
      logger.info('background', { 
        action: 'translation-complete',
        method: translationMethod,
        targetLanguage: target,
      });
      await addDebugLog('translation-complete', { 
        method: translationMethod,
        targetLanguage: target,
        translatedPreview: result.translatedText.substring(0, 100)
      });

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
    logger.apiDebug('Sending result to frontend:', {
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
        payload: { code: 'MISSING_API_KEY', message: 'Add your FreeLLMAPI key in Settings.' },
      };
    }
    if (error.message === 'INVALID_API_KEY') {
      return {
        type: 'ERROR',
        payload: { code: 'INVALID_API_KEY', message: 'Invalid FreeLLMAPI key. Please check your settings.' },
      };
    }
    if (error.message === 'RATE_LIMITED') {
      return {
        type: 'ERROR',
        payload: { code: 'RATE_LIMITED', message: 'Rate limit reached, try again shortly.' },
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
  try {
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
      const maskedKey = settings.freeLLMApiKey 
        ? `${settings.freeLLMApiKey.substring(0, 6)}...${settings.freeLLMApiKey.slice(-4)}`
        : 'MISSING';
      logger.debug('ai-simplify', { settings: { ...settings, freeLLMApiKey: maskedKey }, apiKeyLength: settings.freeLLMApiKey?.length ?? 0 });
      try {
        const result = await simplify(message.payload.text);
        return { type: 'AI_SIMPLIFY_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'AI_CORRECT_GRAMMAR': {
      const settings = await getSettings();
      const maskedKey = settings.freeLLMApiKey 
        ? `${settings.freeLLMApiKey.substring(0, 6)}...${settings.freeLLMApiKey.slice(-4)}`
        : 'MISSING';
      logger.debug('ai-correct-grammar', { settings: { ...settings, freeLLMApiKey: maskedKey }, apiKeyLength: settings.freeLLMApiKey?.length ?? 0 });
      try {
        const result = await correctGrammar(message.payload.text);
        return { type: 'AI_CORRECT_GRAMMAR_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'AI_SUMMARIZE': {
      const settings = await getSettings();
      const maskedKey = settings.freeLLMApiKey 
        ? `${settings.freeLLMApiKey.substring(0, 6)}...${settings.freeLLMApiKey.slice(-4)}`
        : 'MISSING';
      logger.debug('ai-summarize', { settings: { ...settings, freeLLMApiKey: maskedKey }, apiKeyLength: settings.freeLLMApiKey?.length ?? 0 });
      try {
        const result = await summarize(message.payload.text);
        return { type: 'AI_SUMMARIZE_RESULT', payload: result };
      } catch (error) {
        return handleAiError(error);
      }
    }

    case 'AI_REWRITE': {
      const settings = await getSettings();
      const maskedKey = settings.freeLLMApiKey 
        ? `${settings.freeLLMApiKey.substring(0, 6)}...${settings.freeLLMApiKey.slice(-4)}`
        : 'MISSING';
      logger.debug('ai-rewrite', { settings: { ...settings, freeLLMApiKey: maskedKey }, apiKeyLength: settings.freeLLMApiKey?.length ?? 0 });
      try {
        const result = await rewrite(message.payload.text, message.payload.tone);
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
  } catch (error) {
    logger.error('background', { 
      action: 'unhandled-error', 
      messageType: message.type,
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      type: 'ERROR',
      payload: {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Unexpected error in message handler.',
      },
    };
  }
}

// DEBUG FUNCTION: Call this from service worker console to clear ALL stored settings
// Usage: await clearAllStorage()
export async function clearAllStorage(): Promise<void> {
  await chrome.storage.local.clear();
  logger.debug('storage', { action: 'cleared-all' });
}

// DEBUG FUNCTION: View debug logs from service worker console
// Usage: await viewDebugLogs()
export async function viewDebugLogs(): Promise<void> {
  const result = await chrome.storage.local.get('debugLogs') as { debugLogs?: DebugLogEntry[] };
  const logs = result.debugLogs || [];
  console.table(logs);
  console.log('Last 20 log entries:');
  console.table(logs.slice(-20));
}

// DEBUG FUNCTION: Clear debug logs
// Usage: await clearDebugLogs()
export async function clearDebugLogs(): Promise<void> {
  await chrome.storage.local.remove('debugLogs');
  console.log('Debug logs cleared');
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
