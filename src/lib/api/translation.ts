import type { TranslationRequest, TranslationResult } from '@/types';
import { isSingleWord, normalizeLanguageCode, resolveSourceLanguage } from '@/lib/utils';

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Generic translation provider interface.
 * Swap implementations without changing callers.
 */
export interface TranslationProvider {
  readonly name: string;
  translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult>;
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
    match?: number;
  };
  responseStatus?: number;
  responseDetails?: string;
  matches?: Array<{
    source?: string;
  }>;
}

interface DictionaryDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface DictionaryMeaning {
  partOfSpeech?: string;
  definitions?: DictionaryDefinition[];
}

interface DictionaryEntry {
  meanings?: DictionaryMeaning[];
}

interface DictionaryEnrichment {
  partOfSpeech: string | null;
  definition: string | null;
  synonyms: string[];
  antonyms: string[];
  exampleSentences: string[];
}

/** Maps app language codes to MyMemory-compatible codes. */
const MYMEMORY_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
};

function toMyMemoryLang(code: string): string {
  const normalized = normalizeLanguageCode(code);
  return MYMEMORY_LANG_MAP[normalized] ?? normalized;
}

export class MyMemoryTranslationProvider implements TranslationProvider {
  readonly name = 'mymemory';

  async translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw translationError('OFFLINE', 'You appear to be offline.');
    }

    const text = request.text.trim();
    if (!text) {
      throw translationError('INVALID_REQUEST', 'No text provided for translation.');
    }

    if (text.length > 5000) {
      throw translationError('INVALID_REQUEST', 'Text exceeds maximum length (5000 characters).');
    }

    const requestedSource = normalizeLanguageCode(request.sourceLanguage ?? 'auto');
    const target = normalizeLanguageCode(request.targetLanguage);

    if (requestedSource !== 'auto' && requestedSource === target) {
      throw translationError('INVALID_REQUEST', 'Source and target language must differ.');
    }

    const sourceParam = toMyMemoryLang(requestedSource);
    const targetParam = toMyMemoryLang(target);

    const { translatedText, detectedSource } = await fetchMyMemoryTranslation(
      text,
      sourceParam,
      targetParam,
      myMemoryEmail,
    );
    const resolvedSource =
      requestedSource === 'auto'
        ? (detectedSource ?? resolveSourceLanguage('auto', request.pageLanguage))
        : requestedSource;
    const enrichment =
      requestedSource === 'auto'
        ? null
        : await fetchDictionaryEnrichment(text, requestedSource, target, translatedText);

    return {
      translatedText,
      detectedSourceLanguage: resolvedSource,
      targetLanguage: target,
      provider: this.name,
      cached: false,
      partOfSpeech: enrichment?.partOfSpeech ?? null,
      definition: enrichment?.definition ?? null,
      synonyms: enrichment?.synonyms ?? [],
      antonyms: enrichment?.antonyms ?? [],
      exampleSentences: enrichment?.exampleSentences ?? [],
    };
  }
}

async function fetchMyMemoryTranslation(
  text: string,
  source: string,
  target: string,
  myMemoryEmail?: string,
): Promise<{ translatedText: string; detectedSource?: string }> {
  // MyMemory API uses "autodetect" for automatic language detection
  const sourceParam = source === 'auto' ? 'autodetect' : source;
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceParam}|${target}`,
  });

  const email = myMemoryEmail?.trim();
  if (email) {
    params.set('de', email);
  }

  let response: Response;
  try {
    response = await fetch(`${MYMEMORY_ENDPOINT}?${params.toString()}`);
  } catch {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  if (!response.ok) {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  let data: MyMemoryResponse;
  try {
    data = (await response.json()) as MyMemoryResponse;
  } catch {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  if (data.responseStatus === 403) {
    throw translationError(
      'RATE_LIMITED',
      'Daily free translation limit reached — resets at midnight. Add your email in Settings for a higher limit.',
    );
  }

  if (data.responseStatus !== 200) {
    const detail = data.responseDetails ?? 'Translation failed. Please try again.';
    throw translationError('API_FAILURE', detail);
  }

  const translatedText = data.responseData?.translatedText?.trim();
  if (!translatedText) {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  const detectedSource =
    source === 'auto' && data.matches?.[0]?.source
      ? normalizeLanguageCode(data.matches[0].source)
      : undefined;

  return { translatedText, detectedSource };
}

function getEnglishLookupWord(
  text: string,
  source: string,
  target: string,
  translatedText: string,
): string | null {
  if (!isSingleWord(text)) return null;
  if (source === 'en') return text;
  if (target === 'en' && isSingleWord(translatedText)) return translatedText;
  return null;
}

async function fetchDictionaryEnrichment(
  text: string,
  source: string,
  target: string,
  translatedText: string,
): Promise<DictionaryEnrichment | null> {
  const word = getEnglishLookupWord(text, source, target, translatedText);
  if (!word) return null;

  try {
    const response = await fetch(`${DICTIONARY_ENDPOINT}/${encodeURIComponent(word.toLowerCase())}`);
    if (response.status === 404) return null;
    if (!response.ok) return null;

    const entries = (await response.json()) as DictionaryEntry[];
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const definitions: string[] = [];
    const synonyms = new Set<string>();
    const antonyms = new Set<string>();
    const examples: string[] = [];
    let partOfSpeech: string | null = null;

    for (const entry of entries) {
      for (const meaning of entry.meanings ?? []) {
        if (!partOfSpeech && meaning.partOfSpeech) {
          partOfSpeech = meaning.partOfSpeech;
        }

        for (const def of meaning.definitions ?? []) {
          if (def.definition && definitions.length < 3) {
            definitions.push(def.definition);
          }
          if (def.example && examples.length < 3) {
            examples.push(def.example);
          }
          for (const syn of def.synonyms ?? []) {
            if (synonyms.size < 8) synonyms.add(syn);
          }
          for (const ant of def.antonyms ?? []) {
            if (antonyms.size < 8) antonyms.add(ant);
          }
        }
      }
    }

    if (definitions.length === 0 && synonyms.size === 0 && antonyms.size === 0 && examples.length === 0) {
      return null;
    }

    return {
      partOfSpeech,
      definition: definitions.length > 0 ? definitions.join(' · ') : null,
      synonyms: [...synonyms],
      antonyms: [...antonyms],
      exampleSentences: examples,
    };
  } catch {
    return null;
  }
}

/** Mock provider for development and tests. */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = 'mock';

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    await delay(300 + Math.random() * 400);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw translationError('OFFLINE', 'You appear to be offline.');
    }

    const text = request.text.trim();
    if (!text) {
      throw translationError('INVALID_REQUEST', 'No text provided for translation.');
    }

    if (text.length > 5000) {
      throw translationError('RATE_LIMITED', 'Text exceeds maximum length (5000 characters).');
    }

    const detected = resolveSourceLanguage(
      request.sourceLanguage ?? 'auto',
      request.pageLanguage,
    );

    return {
      translatedText: `[${request.targetLanguage}] ${text}`,
      detectedSourceLanguage: detected,
      targetLanguage: request.targetLanguage,
      provider: this.name,
      cached: false,
      partOfSpeech: null,
      definition: null,
      synonyms: [],
      antonyms: [],
      exampleSentences: [],
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function translationError(
  code: import('@/types').TranslationErrorCode,
  message: string,
): Error & { code: import('@/types').TranslationErrorCode } {
  const err = new Error(message) as Error & { code: import('@/types').TranslationErrorCode };
  err.code = code;
  return err;
}

export function isTranslationError(
  error: unknown,
): error is Error & { code: import('@/types').TranslationErrorCode } {
  return error instanceof Error && 'code' in error && typeof (error as { code: unknown }).code === 'string';
}

export const defaultTranslationProvider: TranslationProvider = new MyMemoryTranslationProvider();

/**
 * Google Translate provider (requires API key).
 * Note: This is a placeholder - Google Translate API requires proper authentication.
 */
export class GoogleTranslateProvider implements TranslationProvider {
  readonly name = 'google';

  async translate(request: TranslationRequest, _myMemoryEmail?: string): Promise<TranslationResult> {
    // Placeholder implementation - requires Google Cloud Translation API key
    throw translationError('MISSING_API_KEY', 'Google Translate provider requires API key configuration.');
  }
}

/**
 * Fallback chain provider that tries multiple providers in sequence.
 * If the primary provider fails, it falls back to secondary providers.
 */
export class FallbackTranslationProvider implements TranslationProvider {
  readonly name = 'fallback';
  private providers: TranslationProvider[];

  constructor(providers: TranslationProvider[]) {
    if (providers.length === 0) {
      throw new Error('Fallback provider requires at least one provider');
    }
    this.providers = providers;
  }

  async translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.translate(request, myMemoryEmail);
        // Mark which provider succeeded
        return { ...result, provider: `${provider.name} (via fallback)` };
      } catch (error) {
        if (isTranslationError(error)) {
          errors.push(error);
          // Retry with next provider on rate limit or API failure
          if (error.code === 'RATE_LIMITED' || error.code === 'API_FAILURE') {
            continue;
          }
          // Don't retry on client errors
          throw error;
        }
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // All providers failed
    throw translationError(
      'API_FAILURE',
      `All translation providers failed: ${errors.map(e => e.message).join(', ')}`,
    );
  }
}

/**
 * Create a fallback chain with MyMemory as primary and Mock as fallback.
 * To use real providers, replace MockTranslationProvider with configured providers.
 */
export function createFallbackProvider(): TranslationProvider {
  return new FallbackTranslationProvider([
    new MyMemoryTranslationProvider(),
    new MockTranslationProvider(), // Fallback for development/testing
  ]);
}
