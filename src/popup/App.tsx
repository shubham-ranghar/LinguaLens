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
      <div className={`ll-root flex h-96 w-96 items-center justify-center p-4 ${resolveTheme('system') === 'dark' ? 'dark' : ''}`}>
        <span className="ll-text-base ll-text-secondary">Loading…</span>
      </div>
    );
  }

  return (
    <ThemeWrapper theme={currentTheme}>
      <div className="ll-popup-shell">
        <header className="ll-popup-shell__header">
          <div>
            <h1 className="ll-text-xl font-bold">{t('appName')}</h1>
            <p className="ll-text-sm ll-text-secondary mt-1">
              Target: {getLanguageLabel(settings?.targetLanguage ?? 'en')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => chrome.runtime.openOptionsPage()}
            aria-label="Open settings"
          >
            ⚙
          </Button>
        </header>

        {quota?.showWarning && (
          <div className="ll-banner ll-banner--warning ll-animate-slide-up mb-4">
            <span className="mr-2" aria-hidden="true">⚠️</span>
            {tQuotaWarning(quota.wordsRemaining)}
          </div>
        )}

        <div className="mb-4">
          <Input
            type="search"
            placeholder={tab === 'history' ? t('searchHistory') : 'Search vocabulary…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {error && (
          <div className="ll-banner ll-banner--error ll-animate-slide-up mb-4">
            <span className="mr-2" aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <div className="ll-tab-control">
            <button
              type="button"
              onClick={() => setTab('history')}
              data-active={tab === 'history'}
              className="ll-tab-control__button ll-focus-ring"
            >
              {t('history')}
            </button>
            <button
              type="button"
              onClick={() => setTab('vocabulary')}
              data-active={tab === 'vocabulary'}
              className="ll-tab-control__button ll-focus-ring"
            >
              Vocabulary
            </button>
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
          <div className="ll-card-section">
            <div className="ll-card-section__header">
              <h3 className="ll-card-section__title">Review Mode</h3>
              <div className="ll-status-badge ll-status-badge--success">
                <span className="ll-status-badge__dot"></span>
                {reviewIndex + 1}/{vocabulary.length}
              </div>
            </div>
            <div className="space-y-4">
              <div className="ll-card-alt p-4">
                <p className="ll-text-lg font-semibold">{vocabulary[reviewIndex].sourceText}</p>
                <Button
                  variant="pill"
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
                <Button variant="ghost" size="sm" onClick={() => void handleNextReview()}>
                  {reviewIndex === vocabulary.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)} className="w-full">
                Exit Review
              </Button>
            </div>
          </div>
        ) : reviewMode ? (
          <div className="ll-card-section">
            <p className="ll-text-base ll-text-secondary">
              Review list changed. Exiting review mode.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setReviewMode(false)} className="w-full mt-3">
              Exit Review
            </Button>
          </div>
        ) : tab === 'history' ? (
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {history.length === 0 ? (
              <div className="ll-empty-state ll-card-section">
                <div className="ll-empty-state-icon">📜</div>
                <p className="ll-empty-state-text">{t('noHistory')}</p>
                <p className="ll-empty-state-action">Select text on a page to start translating</p>
              </div>
            ) : (
              history.map((entry) => (
                <article key={entry.id} className="ll-card-section ll-animate-slide-up">
                  <p className="ll-text-base font-semibold mb-2">{entry.originalText}</p>
                  <p className="ll-text-sm ll-text-secondary mb-3 line-clamp-2">
                    {entry.translatedText}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="ll-text-xs ll-text-disabled">
                      {getLanguageLabel(entry.sourceLanguage)} → {getLanguageLabel(entry.targetLanguage)}
                    </p>
                    <p className="ll-text-xs ll-text-disabled">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
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
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {vocabulary.length === 0 ? (
                <div className="ll-empty-state ll-card-section">
                  <div className="ll-empty-state-icon">📚</div>
                  <p className="ll-empty-state-text">No vocabulary saved yet</p>
                  <p className="ll-empty-state-action">Use the 📚 button when translating to save words</p>
                </div>
              ) : (
                vocabulary.map((entry) => (
                  <article key={entry.id} className="ll-card-section ll-animate-slide-up">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <p className="ll-text-base font-semibold line-clamp-1">{entry.sourceText}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteVocab(entry.id)}
                        className="shrink-0"
                        aria-label={`Delete ${entry.sourceText}`}
                      >
                        ×
                      </Button>
                    </div>
                    <p className="ll-text-sm ll-text-secondary mb-3 line-clamp-2">
                      {entry.translatedText}
                    </p>
                    {entry.tags.length > 0 && (
                      <p className="ll-text-xs ll-text-disabled">
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
