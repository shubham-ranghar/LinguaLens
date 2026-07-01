import { getSettings } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/storage/constants';

export const MYMEMORY_DAILY_LIMIT_ANONYMOUS = 5000;
export const MYMEMORY_DAILY_LIMIT_WITH_EMAIL = 50000;
export const QUOTA_WARNING_THRESHOLD = 0.9;

export interface QuotaUsage {
  date: string;
  wordCount: number;
}

export interface QuotaStatus {
  wordCount: number;
  dailyLimit: number;
  wordsRemaining: number;
  showWarning: boolean;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function getDailyLimit(hasEmail: boolean): number {
  return hasEmail ? MYMEMORY_DAILY_LIMIT_WITH_EMAIL : MYMEMORY_DAILY_LIMIT_ANONYMOUS;
}

async function readQuotaUsage(): Promise<QuotaUsage> {
  const stored = await chrome.storage.local
    .get(STORAGE_KEYS.quotaUsage)
    .then((result) => result[STORAGE_KEYS.quotaUsage] as QuotaUsage | undefined);

  const today = localDateKey();
  if (!stored || stored.date !== today) {
    return { date: today, wordCount: 0 };
  }
  return stored;
}

async function writeQuotaUsage(usage: QuotaUsage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.quotaUsage]: usage });
}

export async function getQuotaUsage(): Promise<QuotaUsage> {
  return readQuotaUsage();
}

export async function addQuotaWords(wordCount: number): Promise<QuotaUsage> {
  if (wordCount <= 0) return readQuotaUsage();

  const usage = await readQuotaUsage();
  const updated = { ...usage, wordCount: usage.wordCount + wordCount };
  await writeQuotaUsage(updated);
  return updated;
}

export async function getQuotaStatus(myMemoryEmail?: string): Promise<QuotaStatus> {
  const settings = myMemoryEmail !== undefined ? { myMemoryEmail } : await getSettings();
  const hasEmail = Boolean(settings.myMemoryEmail?.trim());
  const dailyLimit = getDailyLimit(hasEmail);
  const usage = await readQuotaUsage();
  const wordsRemaining = Math.max(0, dailyLimit - usage.wordCount);
  const showWarning = usage.wordCount >= dailyLimit * QUOTA_WARNING_THRESHOLD;

  return {
    wordCount: usage.wordCount,
    dailyLimit,
    wordsRemaining,
    showWarning,
  };
}
