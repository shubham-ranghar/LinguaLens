import type { HistoryEntry, UserSettings, VocabularyEntry } from '@/types';
import {
  CACHE_MAX_ENTRIES,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  VOCABULARY_MAX_ENTRIES,
} from './constants';

function getSync<T>(key: string): Promise<T | undefined> {
  return chrome.storage.sync.get(key).then((result) => result[key] as T | undefined);
}

function setSync<T>(key: string, value: T): Promise<void> {
  return chrome.storage.sync.set({ [key]: value });
}

function getLocal<T>(key: string): Promise<T | undefined> {
  return chrome.storage.local.get(key).then((result) => result[key] as T | undefined);
}

function setLocal<T>(key: string, value: T): Promise<void> {
  return chrome.storage.local.set({ [key]: value });
}

/** Settings synced across devices (excludes secrets and FreeLLM base URL). */
type SyncedSettings = Omit<UserSettings, 'myMemoryEmail' | 'geminiApiKey' | 'freeLLMBaseUrl'>;

export async function getSettings(): Promise<UserSettings> {
  const [stored, myMemoryEmail, geminiApiKey, freeLLMBaseUrl] = await Promise.all([
    getSync<Partial<SyncedSettings>>(STORAGE_KEYS.settingsSync),
    getLocal<string>(STORAGE_KEYS.myMemoryEmail),
    getLocal<string>(STORAGE_KEYS.geminiApiKey),
    getLocal<string>(STORAGE_KEYS.freeLLMBaseUrl),
  ]);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    myMemoryEmail: myMemoryEmail ?? '',
    geminiApiKey: geminiApiKey ?? '',
    freeLLMBaseUrl: freeLLMBaseUrl ?? '',
  };
}

export async function saveSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  const { myMemoryEmail, geminiApiKey, freeLLMBaseUrl, ...synced } = merged;
  
  try {
    await setSync(STORAGE_KEYS.settingsSync, synced);
    await setLocal(STORAGE_KEYS.myMemoryEmail, myMemoryEmail);
    await setLocal(STORAGE_KEYS.geminiApiKey, geminiApiKey);
    await setLocal(STORAGE_KEYS.freeLLMBaseUrl, freeLLMBaseUrl ?? '');
    
    return merged;
  } catch (error) {
    console.error('[Storage] saveSettings failed:', error);
    throw error;
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const history = await getLocal<HistoryEntry[]>(STORAGE_KEYS.historyLocal);
  return history ?? [];
}

export async function addHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'timestamp'>,
  maxItems: number,
): Promise<HistoryEntry> {
  const history = await getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const updated = [newEntry, ...history].slice(0, maxItems);
  await setLocal(STORAGE_KEYS.historyLocal, updated);
  return newEntry;
}

export async function clearHistory(): Promise<void> {
  await setLocal(STORAGE_KEYS.historyLocal, []);
}

export interface CacheEntry {
  key: string;
  result: import('@/types').TranslationResult;
  timestamp: number;
  version?: string;  // Added version field for cache invalidation
}

export async function getTranslationCache(): Promise<CacheEntry[]> {
  const cache = await getLocal<CacheEntry[]>(STORAGE_KEYS.translationCache);
  return cache ?? [];
}

export async function setTranslationCacheEntry(entry: CacheEntry): Promise<void> {
  const cache = await getTranslationCache();
  const filtered = cache.filter((c) => c.key !== entry.key);
  const updated = [entry, ...filtered].slice(0, CACHE_MAX_ENTRIES);
  await setLocal(STORAGE_KEYS.translationCache, updated);
}

export function buildCacheKey(
  text: string,
  source: string,
  target: string,
): string {
  return `${source}:${target}:${text.trim().toLowerCase()}`;
}

export async function searchHistory(query: string): Promise<HistoryEntry[]> {
  const history = await getHistory();
  if (!query.trim()) return history;
  const q = query.toLowerCase();
  return history.filter(
    (entry) =>
      entry.originalText.toLowerCase().includes(q) ||
      entry.translatedText.toLowerCase().includes(q),
  );
}

export async function getVocabulary(): Promise<VocabularyEntry[]> {
  const vocabulary = await getLocal<VocabularyEntry[]>(STORAGE_KEYS.vocabularyLocal);
  return vocabulary ?? [];
}

export async function saveVocabularyEntry(
  entry: Omit<VocabularyEntry, 'id' | 'savedAt'>,
): Promise<VocabularyEntry> {
  const vocabulary = await getVocabulary();
  const existingIndex = vocabulary.findIndex(
    (v) => v.sourceText === entry.sourceText && v.targetLanguage === entry.targetLanguage,
  );

  if (existingIndex !== -1) {
    const updated = {
      ...vocabulary[existingIndex],
      ...entry,
      savedAt: Date.now(),
    };
    vocabulary[existingIndex] = updated;
    await setLocal(STORAGE_KEYS.vocabularyLocal, vocabulary);
    return updated;
  }

  const newEntry: VocabularyEntry = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  const updated = [newEntry, ...vocabulary].slice(0, VOCABULARY_MAX_ENTRIES);
  await setLocal(STORAGE_KEYS.vocabularyLocal, updated);
  return newEntry;
}

export async function deleteVocabularyEntry(id: string): Promise<void> {
  const vocabulary = await getVocabulary();
  const filtered = vocabulary.filter((v) => v.id !== id);
  await setLocal(STORAGE_KEYS.vocabularyLocal, filtered);
}

export async function searchVocabulary(query: string, tagFilter?: string): Promise<VocabularyEntry[]> {
  const vocabulary = await getVocabulary();
  let filtered = vocabulary;

  if (tagFilter) {
    filtered = filtered.filter((v) => v.tags.includes(tagFilter));
  }

  if (!query.trim()) return filtered;
  const q = query.toLowerCase();
  return filtered.filter(
    (entry) =>
      entry.sourceText.toLowerCase().includes(q) ||
      entry.translatedText.toLowerCase().includes(q),
  );
}
