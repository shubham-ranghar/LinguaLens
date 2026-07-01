export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
] as const;

export function getLanguageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}

/** Normalize BCP-47 / locale tags to ISO 639-1 codes used by the app. */
export function normalizeLanguageCode(lang: string): string {
  const base = lang.split('-')[0].toLowerCase();
  if (base === 'auto') return 'auto';
  return SUPPORTED_LANGUAGES.some((l) => l.code === base) ? base : base;
}

/** Best-guess page language from document or browser settings. */
export function getPageLanguage(): string {
  const raw =
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    (typeof navigator !== 'undefined' && navigator.language) ||
    'en';
  return normalizeLanguageCode(raw);
}

/** Resolve `auto` source language using an optional page-language hint. */
export function resolveSourceLanguage(source: string, pageLanguage?: string): string {
  if (source !== 'auto') return normalizeLanguageCode(source);
  const raw = pageLanguage || getPageLanguage();
  return normalizeLanguageCode(raw);
}

/** True when the selection is a single word (letters, hyphen, apostrophe). */
export function isSingleWord(text: string): boolean {
  const trimmed = text.trim();
  return /^\p{L}+(?:[-']\p{L}+)*$/u.test(trimmed);
}

// Re-export theme functions from theme.ts for backward compatibility
export { applyThemeToRoot, initTheme, resolveTheme, watchSystemTheme } from './theme';

export function speakText(text: string, lang: string): void {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'auto' ? 'en-US' : lang;
  // Future: swap for cloud TTS (Google Cloud TTS, Amazon Polly) via background worker
  window.speechSynthesis.speak(utterance);
}

export function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

export function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? '';
}
