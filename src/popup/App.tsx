import type { UserSettings } from '@/types';
import { BackgroundError, clearHistory, deleteVocabulary, fetchHistory, fetchQuotaStatus, fetchSettings, fetchVocabulary } from '@/lib/messaging';
import { t, tQuotaWarning } from '@/lib/i18n';
import { getLanguageLabel, resolveTheme } from '@/lib/utils';
import { Button, Input, ThemeWrapper } from '@/components/ui';
import { useCallback, useEffect, useState } from 'react';
import type { QuotaStatus } from '@/lib/quota';

export function PopupApp({ initialTheme }: { initialTheme?: import('@/types').Theme }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [tab, setTab] = useState<'history' | 'vocabulary'>('history');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [history, setHistory] = useState<import('@/types').HistoryEntry[]>([]);
  const [vocabulary, setVocabulary] = useState<import('@/types').VocabularyEntry[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<import('@/types').Theme>(initialTheme ?? 'system');

  const load = useCallback(async (searchQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, historyRes, vocabRes, quotaRes] = await Promise.all([
        fetchSettings(),
        fetchHistory(searchQuery),
        fetchVocabulary(searchQuery, tagFilter),
        fetchQuotaStatus(),
      ]);
      setSettings(settingsRes.payload);
      setCurrentTheme(settingsRes.payload.theme);
      setHistory(historyRes.payload);
      setVocabulary(vocabRes.payload);
      setQuota(quotaRes.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tagFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'sync' && changes.lingualens_settings) {
        const newSettings = changes.lingualens_settings.newValue as Partial<UserSettings>;
        if (newSettings.theme !== undefined) {
          setCurrentTheme(newSettings.theme);
          setSettings(prev => prev ? { ...prev, theme: newSettings.theme! } : null);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleClear = async () => {
    try {
      await clearHistory();
      setHistory([]);
    } catch (err) {
      setError(err instanceof BackgroundError ? err.message : 'Failed to clear history');
    }
  };

  const handleDeleteVocab = async (id: string) => {
    try {
      await deleteVocabulary(id);
      if (reviewMode) {
        setReviewMode(false);
        setReviewIndex(0);
      }
      void load(query);
    } catch (err) {
      setError(err instanceof BackgroundError ? err.message : 'Failed to delete');
    }
  };

  const handleStartReview = () => {
    if (vocabulary.length === 0) return;
    setReviewMode(true);
    setReviewIndex(0);
    setReviewRevealed(false);
  };

  const handleNextReview = () => {
    if (reviewIndex < vocabulary.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setReviewRevealed(false);
    } else {
      setReviewMode(false);
    }
  };

  const handlePrevReview = () => {
    if (reviewIndex > 0) {
      setReviewIndex(reviewIndex - 1);
      setReviewRevealed(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className={`ll-root flex h-80 w-96 items-center justify-center p-4 ${resolveTheme('system') === 'dark' ? 'dark' : ''}`}>
        <span className="ll-text-base ll-text-secondary">Loading…</span>
      </div>
    );
  }

  return (
    <ThemeWrapper theme={currentTheme}>
      <div className="ll-popup-shell">
        <header className="ll-popup-shell__header">
          <h1 className="ll-text-lg font-bold">{t('appName')}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => chrome.runtime.openOptionsPage()}
            aria-label="Open settings"
          >
            ⚙ {t('settings')}
          </Button>
        </header>

        <p className="ll-text-xs ll-text-secondary mb-3">
          Select text on any page, then click the 🌐 button to translate.
          Target: {getLanguageLabel(settings?.targetLanguage ?? 'en')}
        </p>

        {quota?.showWarning && (
          <div className="ll-banner ll-banner--warning ll-animate-slide-up mb-3">
            <span className="mr-2" aria-hidden="true">⚠️</span>
            {tQuotaWarning(quota.wordsRemaining)}
          </div>
        )}

        <div className="mb-3">
          <Input
            type="search"
            placeholder={tab === 'history' ? t('searchHistory') : 'Search vocabulary…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {error && (
          <div className="ll-banner ll-banner--error ll-animate-slide-up mb-3">
            <span className="mr-2" aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <div className="relative flex gap-1">
            <button
              type="button"
              onClick={() => setTab('history')}
              data-active={tab === 'history'}
              className="ll-tab ll-focus-ring"
            >
              {t('history')}
            </button>
            <button
              type="button"
              onClick={() => setTab('vocabulary')}
              data-active={tab === 'vocabulary'}
              className="ll-tab ll-focus-ring"
            >
              Vocabulary
            </button>
            <div
              className="ll-tab-indicator"
              style={{
                width: tab === 'history' ? '56px' : '80px',
                left: tab === 'history' ? '10px' : '74px',
              }}
            />
          </div>
          {tab === 'history' && history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void handleClear()}>
              {t('clearHistory')}
            </Button>
          )}
          {tab === 'vocabulary' && vocabulary.length > 0 && !reviewMode && (
            <Button variant="ghost" size="sm" onClick={() => void handleStartReview()}>
              Review
            </Button>
          )}
        </div>

        {reviewMode && vocabulary.length > 0 && reviewIndex < vocabulary.length ? (
          <div className="space-y-3">
            <div className="ll-list-item">
              <p className="ll-text-lg font-medium">{vocabulary[reviewIndex].sourceText}</p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setReviewRevealed(!reviewRevealed)}
              >
                {reviewRevealed ? 'Hide' : 'Reveal'}
              </Button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${reviewRevealed ? 'max-h-32 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <p className="ll-text-base ll-text-secondary">
                  {vocabulary[reviewIndex].translatedText}
                </p>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => void handlePrevReview()} disabled={reviewIndex === 0}>
                Previous
              </Button>
              <span className="ll-text-base ll-text-secondary">
                {reviewIndex + 1} / {vocabulary.length}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void handleNextReview()}>
                {reviewIndex === vocabulary.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)} className="w-full">
              Exit Review
            </Button>
          </div>
        ) : reviewMode ? (
          <div className="space-y-3">
            <p className="ll-text-base ll-text-secondary">
              Review list changed. Exiting review mode.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)} className="w-full">
              Exit Review
            </Button>
          </div>
        ) : tab === 'history' ? (
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {history.length === 0 ? (
              <div className="ll-empty-state ll-list-item">
                <div className="ll-empty-state-icon">📜</div>
                <p className="ll-empty-state-text">{t('noHistory')}</p>
                <p className="ll-empty-state-action">Select text on a page to start translating</p>
              </div>
            ) : (
              history.map((entry) => (
                <article key={entry.id} className="ll-list-item ll-animate-slide-up ll-text-base">
                  <p className="line-clamp-2 font-medium">{entry.originalText}</p>
                  <p className="line-clamp-2 ll-text-secondary">
                    {entry.translatedText}
                  </p>
                  <p className="mt-1 ll-text-xs ll-text-disabled">
                    {getLanguageLabel(entry.sourceLanguage)} →{' '}
                    {getLanguageLabel(entry.targetLanguage)} ·{' '}
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </p>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                inputSize="sm"
                placeholder="Filter by tag…"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {vocabulary.length === 0 ? (
                <div className="ll-empty-state ll-list-item">
                  <div className="ll-empty-state-icon">📚</div>
                  <p className="ll-empty-state-text">No vocabulary saved yet</p>
                  <p className="ll-empty-state-action">Use the 📚 button when translating to save words</p>
                </div>
              ) : (
                vocabulary.map((entry) => (
                  <article key={entry.id} className="ll-list-item ll-animate-slide-up ll-text-base">
                    <div className="flex justify-between gap-2">
                      <p className="line-clamp-1 font-medium">{entry.sourceText}</p>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDeleteVocab(entry.id)}
                        className="shrink-0"
                        aria-label={`Delete ${entry.sourceText}`}
                      >
                        Delete
                      </Button>
                    </div>
                    <p className="line-clamp-2 ll-text-secondary">
                      {entry.translatedText}
                    </p>
                    {entry.tags.length > 0 && (
                      <p className="mt-1 ll-text-xs ll-text-disabled">
                        Tags: {entry.tags.join(', ')}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </ThemeWrapper>
  );
}
