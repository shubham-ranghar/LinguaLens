import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  ErrorBanner,
  LoadingSpinner,
  Select,
  ThemeWrapper,
} from '@/components/ui';
import { t, tQuotaWarning } from '@/lib/i18n';
import { BackgroundError, fetchAiCorrectGrammar, fetchAiRewrite, fetchAiSimplify, fetchAiSummarize, fetchQuotaStatus, saveVocabulary, sendToBackground } from '@/lib/messaging';
import type { QuotaStatus } from '@/lib/quota';
import {
  SUPPORTED_LANGUAGES,
  getLanguageLabel,
  getPageLanguage,
  normalizeLanguageCode,
  speakText,
} from '@/lib/utils';
import type { TranslationResult, UserSettings } from '@/types';
import type { GrammarChange } from '@/lib/api/ai-features';

export interface SelectionPopupProps {
  selectedText: string;
  position: { top: number; left: number };
  onClose: () => void;
  settings: UserSettings;
}

type ViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: TranslationResult }
  | { status: 'error'; message: string }
  | { status: 'ai-loading'; aiOperation: string }
  | { status: 'ai-success'; aiResult: string; aiOperation: string; grammarChanges?: GrammarChange[] }
  | { status: 'ai-error'; message: string };

function GlobeIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function errorMessageFromCode(code: string, fallback: string): string {
  const map: Record<string, string> = {
    OFFLINE: t('offline'),
    API_FAILURE: t('apiFailure'),
    UNSUPPORTED_LANGUAGE: t('unsupportedLanguage'),
    RATE_LIMITED: t('quotaExceeded'),
    MISSING_API_KEY: t('missingApiKey'),
    TIMEOUT: 'Request timed out. Please try again.',
  };
  if (code === 'RATE_LIMITED' || code === 'API_FAILURE') {
    return fallback || map[code];
  }
  return map[code] ?? fallback;
}

function DictionaryDetails({ result }: { result: TranslationResult }) {
  const hasDetails =
    result.definition ||
    (result.synonyms && result.synonyms.length > 0) ||
    (result.antonyms && result.antonyms.length > 0) ||
    (result.exampleSentences && result.exampleSentences.length > 0);

  if (!hasDetails) return null;

  return (
    <div className="ll-selection-popup__dictionary">
      {result.partOfSpeech && (
        <p className="ll-selection-popup__dictionary-pos">{result.partOfSpeech}</p>
      )}
      {result.definition && (
        <p className="ll-text-secondary">{result.definition}</p>
      )}
      {result.synonyms && result.synonyms.length > 0 && (
        <p className="ll-text-secondary">
          Synonyms: {result.synonyms.join(', ')}
        </p>
      )}
      {result.antonyms && result.antonyms.length > 0 && (
        <p className="ll-text-secondary">
          Antonyms: {result.antonyms.join(', ')}
        </p>
      )}
      {result.exampleSentences && result.exampleSentences.length > 0 && (
        <p className="italic ll-text-secondary">
          “{result.exampleSentences[0]}”
        </p>
      )}
    </div>
  );
}

export function SelectionPopup({
  selectedText,
  position,
  onClose,
  settings,
}: SelectionPopupProps) {
  const [sourceLang, setSourceLang] = useState(settings.sourceLanguage);
  const [targetLang, setTargetLang] = useState(settings.targetLanguage);
  const [view, setView] = useState<ViewState>({ status: 'idle' });
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [savedToVocab, setSavedToVocab] = useState(false);
  const selectedTextRef = useRef(selectedText);

  // Only block when both dropdowns explicitly pick the same language.
  // "Auto-detect" must not be resolved to page language here — that caused
  // false positives (e.g. Auto-detect → English on an English page).
  const normalizedSourceLang = normalizeLanguageCode(sourceLang);
  const normalizedTargetLang = normalizeLanguageCode(targetLang);
  const isSameLanguage =
    sourceLang !== 'auto' && normalizedSourceLang === normalizedTargetLang;
  const showTranslateButton = settings.popupBehavior === 'click-to-show';
  const isTranslateBusy = view.status === 'loading' || view.status === 'ai-loading';

  const POPUP_MAX_HEIGHT = 480;

  const loadQuota = useCallback(async () => {
    try {
      const response = await fetchQuotaStatus();
      setQuota(response.payload);
    } catch {
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  useEffect(() => {
    selectedTextRef.current = selectedText;
  }, [selectedText]);

  const handleSaveToVocabulary = useCallback(async () => {
    if (view.status !== 'success') return;
    
    try {
      await saveVocabulary({
        sourceText: selectedTextRef.current,
        translatedText: view.result.translatedText,
        sourceLanguage: view.result.detectedSourceLanguage,
        targetLanguage: view.result.targetLanguage,
        definition: view.result.definition,
        synonyms: view.result.synonyms,
        tags: [],
      });
      setSavedToVocab(true);
      window.setTimeout(() => setSavedToVocab(false), 2000);
    } catch {
      // Silently fail or show error
    }
  }, [view]);

  const runTranslation = useCallback(async () => {
    if (
      sourceLang !== 'auto' &&
      normalizeLanguageCode(sourceLang) === normalizeLanguageCode(targetLang)
    ) {
      return;
    }

    const textToTranslate = selectedTextRef.current;
    setView({ status: 'loading' });
    try {
      const response = await sendToBackground(
        {
          type: 'TRANSLATE',
          payload: {
            text: textToTranslate,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
            pageLanguage: getPageLanguage(),
          },
        },
        'TRANSLATE_RESULT',
      );

      if (selectedTextRef.current !== textToTranslate) {
        return;
      }

      setView({ status: 'success', result: response.payload });
      void loadQuota();

      void sendToBackground(
        {
          type: 'ADD_HISTORY',
          payload: {
            originalText: textToTranslate,
            translatedText: response.payload.translatedText,
            sourceLanguage: response.payload.detectedSourceLanguage,
            targetLanguage: response.payload.targetLanguage,
            url: window.location.href,
          },
        },
        'HISTORY_ADDED',
      );
    } catch (error) {
      if (selectedTextRef.current !== textToTranslate) {
        return;
      }

      if (error instanceof BackgroundError) {
        setView({
          status: 'error',
          message: errorMessageFromCode(error.code, error.message),
        });
      } else {
        setView({
          status: 'error',
          message: error instanceof Error ? error.message : t('apiFailure'),
        });
      }
    }
  }, [sourceLang, targetLang, loadQuota]);

  const handleAiSimplify = useCallback(async () => {
    const textToProcess = selectedTextRef.current;
    setView({ status: 'ai-loading', aiOperation: 'simplify' });
    try {
      const response = await fetchAiSimplify(textToProcess);
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      setView({ status: 'ai-success', aiResult: response.payload, aiOperation: 'simplify' });
    } catch (error) {
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      if (error instanceof BackgroundError) {
        setView({
          status: 'ai-error',
          message: errorMessageFromCode(error.code, error.message),
        });
      } else {
        setView({
          status: 'ai-error',
          message: error instanceof Error ? error.message : 'AI request failed.',
        });
      }
    }
  }, []);

  const handleAiGrammar = useCallback(async () => {
    const textToProcess = selectedTextRef.current;
    setView({ status: 'ai-loading', aiOperation: 'grammar' });
    try {
      const response = await fetchAiCorrectGrammar(textToProcess);
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      const grammarResult = response.payload;
      setView({
        status: 'ai-success',
        aiResult: grammarResult.corrected,
        aiOperation: 'grammar',
        grammarChanges: grammarResult.changes
      });
    } catch (error) {
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      if (error instanceof BackgroundError) {
        setView({
          status: 'ai-error',
          message: errorMessageFromCode(error.code, error.message),
        });
      } else {
        setView({
          status: 'ai-error',
          message: error instanceof Error ? error.message : 'AI request failed.',
        });
      }
    }
  }, []);

  const handleAiSummarize = useCallback(async () => {
    const textToProcess = selectedTextRef.current;
    setView({ status: 'ai-loading', aiOperation: 'summarize' });
    try {
      const response = await fetchAiSummarize(textToProcess);
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      setView({ status: 'ai-success', aiResult: response.payload, aiOperation: 'summarize' });
    } catch (error) {
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      if (error instanceof BackgroundError) {
        setView({
          status: 'ai-error',
          message: errorMessageFromCode(error.code, error.message),
        });
      } else {
        setView({
          status: 'ai-error',
          message: error instanceof Error ? error.message : 'AI request failed.',
        });
      }
    }
  }, []);

  const handleAiRewrite = useCallback(async (tone: 'formal' | 'casual' | 'concise') => {
    const textToProcess = selectedTextRef.current;
    setView({ status: 'ai-loading', aiOperation: `rewrite-${tone}` });
    try {
      const response = await fetchAiRewrite(textToProcess, tone);
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      setView({ status: 'ai-success', aiResult: response.payload, aiOperation: `rewrite-${tone}` });
    } catch (error) {
      if (selectedTextRef.current !== textToProcess) {
        return;
      }
      if (error instanceof BackgroundError) {
        setView({
          status: 'ai-error',
          message: errorMessageFromCode(error.code, error.message),
        });
      } else {
        setView({
          status: 'ai-error',
          message: error instanceof Error ? error.message : 'AI request failed.',
        });
      }
    }
  }, []);

  useEffect(() => {
    if (settings.popupBehavior !== 'auto-show') return;
    if (
      sourceLang !== 'auto' &&
      normalizeLanguageCode(sourceLang) === normalizeLanguageCode(targetLang)
    ) {
      return;
    }
    void runTranslation();
  }, [settings.popupBehavior, runTranslation]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.max(8, Math.min(position.top + 8, window.innerHeight - POPUP_MAX_HEIGHT - 8)),
    left: Math.min(Math.max(position.left, 8), window.innerWidth - 360),
    zIndex: 2147483647,
    width: 340,
    maxHeight: `min(${POPUP_MAX_HEIGHT}px, calc(100vh - 24px))`,
  };

  return (
    <ThemeWrapper theme={settings.theme}>
      <div
        style={style}
        onClick={(e) => e.stopPropagation()}
        className="ll-selection-popup__shell ll-animate-fade-in-scale"
      >
        <div className="ll-selection-popup">
          <header className="ll-selection-popup__header">
            <div className="ll-selection-popup__brand">
              <span className="ll-selection-popup__brand-icon" aria-hidden="true">
                <GlobeIcon size={14} />
              </span>
              <span className="ll-selection-popup__title">{t('appName')}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ll-selection-popup__close ll-focus-ring"
              aria-label="Close popup"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="ll-selection-popup__body">
            {quota?.showWarning && (
              <div className="ll-banner ll-banner--warning ll-selection-popup__banner ll-animate-slide-up">
                <span className="mr-1.5" aria-hidden="true">⚠️</span>
                {tQuotaWarning(quota.wordsRemaining)}
              </div>
            )}

            <p className="ll-selection-popup__source">{selectedText}</p>

            <div className="ll-selection-popup__langs">
              <Select
                label={t('sourceLanguage')}
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </Select>
              <Select
                label={t('targetLanguage')}
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </Select>
            </div>

            {isSameLanguage && (
              <p className="ll-banner ll-banner--warning ll-selection-popup__banner" role="status">
                Source and target language are the same — choose a different target to translate.
              </p>
            )}

            {showTranslateButton && (
              <Button
                variant="primary"
                className="ll-selection-popup__cta"
                disabled={isSameLanguage || isTranslateBusy}
                onClick={() => void runTranslation()}
              >
                {t('translate')}
              </Button>
            )}

            {view.status === 'loading' && (
              <div className="ll-selection-popup__loading">
                <LoadingSpinner message="Translating…" />
              </div>
            )}

            {view.status === 'error' && <ErrorBanner message={view.message} />}

            {view.status === 'ai-loading' && (
              <div className="ll-selection-popup__loading">
                <LoadingSpinner message={`Processing ${view.aiOperation}…`} />
              </div>
            )}

            {view.status === 'ai-error' && (
              <div className="space-y-2">
                <ErrorBanner message={view.message} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView({ status: 'idle' })}
                >
                  Back to translation
                </Button>
              </div>
            )}

            {view.status === 'ai-success' && (
              <div className="ll-selection-popup__panel space-y-2">
                <p className="ll-selection-popup__translation">{view.aiResult}</p>
                {view.aiOperation === 'grammar' && view.grammarChanges && view.grammarChanges.length > 0 && (
                  <div className="ll-selection-popup__dictionary">
                    <p className="ll-selection-popup__dictionary-pos">Changes</p>
                    {view.grammarChanges.map((change, i) => (
                      <p key={i} className="ll-text-secondary">
                        "{change.original}" → "{change.fixed}" ({change.reason})
                      </p>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView({ status: 'idle' })}
                >
                  Back to translation
                </Button>
              </div>
            )}

            {view.status === 'success' && (
              <div className="ll-selection-popup__panel">
                <p className="ll-selection-popup__translation">{view.result.translatedText}</p>
                <DictionaryDetails result={view.result} />
                <p className="ll-selection-popup__meta">
                  {getLanguageLabel(view.result.detectedSourceLanguage)} →{' '}
                  {getLanguageLabel(view.result.targetLanguage)}
                  {view.result.cached && ' · cached'}
                </p>
              </div>
            )}

            <div className="ll-selection-popup__actions">
              <p className="ll-micro-label ll-selection-popup__actions-label">Actions</p>
              <Button
                variant="ghost"
                size="sm"
                disabled={view.status !== 'success'}
                onClick={() => {
                  if (view.status === 'success') {
                    speakText(view.result.translatedText, view.result.targetLanguage);
                  }
                }}
                aria-label="Play pronunciation"
              >
                🔊 {t('pronouncing')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={view.status !== 'success' || savedToVocab}
                onClick={() => void handleSaveToVocabulary()}
                aria-label="Save to vocabulary"
              >
                <span className={savedToVocab ? 'll-animate-fade-in' : ''}>{savedToVocab ? '✓ Saved' : `📚 ${t('saveToVocabulary')}`}</span>
              </Button>
            </div>

            <div className="ll-selection-popup__ai">
              <p className="ll-micro-label ll-selection-popup__ai-label">AI</p>
              <Button
                variant="ai"
                size="sm"
                disabled={view.status === 'ai-loading' || view.status === 'ai-success' || view.status === 'ai-error'}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleAiSimplify();
                }}
              >
                {t('simplify')}
              </Button>
              <Button
                variant="ai"
                size="sm"
                disabled={view.status === 'ai-loading' || view.status === 'ai-success' || view.status === 'ai-error'}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleAiGrammar();
                }}
              >
                {t('grammar')}
              </Button>
              <Button
                variant="ai"
                size="sm"
                disabled={view.status === 'ai-loading' || view.status === 'ai-success' || view.status === 'ai-error'}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleAiSummarize();
                }}
              >
                {t('summarize')}
              </Button>
              <Button
                variant="ai"
                size="sm"
                disabled={view.status === 'ai-loading' || view.status === 'ai-success' || view.status === 'ai-error'}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleAiRewrite('formal');
                }}
              >
                {t('rewrite')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ThemeWrapper>
  );
}

export interface FloatingTriggerProps {
  position: { top: number; left: number };
  onClick: () => void;
}

export function FloatingTrigger({ position, onClick }: FloatingTriggerProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    zIndex: 2147483646,
  };

  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      className="ll-floating-trigger ll-focus-ring ll-animate-scale-in"
      title="Translate with LinguaLens"
      aria-label="Translate selection"
    >
      <GlobeIcon size={17} className="ll-floating-trigger__icon" />
    </button>
  );
}
