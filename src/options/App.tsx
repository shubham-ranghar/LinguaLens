import { useEffect, useState } from 'react';
import { Button, Input, Select, ThemeWrapper } from '@/components/ui';
import { t } from '@/lib/i18n';
import { fetchSettings, updateSettings } from '@/lib/messaging';
import { SUPPORTED_LANGUAGES } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { PopupBehavior, Theme, UserSettings } from '@/types';

export function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [defaultSettings] = useState<UserSettings>({
    sourceLanguage: 'auto',
    targetLanguage: 'en',
    popupBehavior: 'click-to-show',
    theme: 'system',
    myMemoryEmail: '',
    geminiApiKey: '',
    maxHistoryItems: 100,
    hinglishTranslationMode: 'auto',
    freeLLMApiKey: '',
    freeLLMBaseUrl: '',
    aiEnhancedTranslation: false,
  });

  useEffect(() => {
    logger.debug('options-app', { action: 'loading-settings' });
    fetchSettings()
      .then((res) => {
        logger.debug('options-app', { action: 'settings-loaded', settings: res.payload });
        setSettings(res.payload);
      })
      .catch((err) => {
        logger.error('options-app', { action: 'settings-load-failed', error: err instanceof Error ? err.message : String(err) });
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      });
    
    // Load debug logs
    chrome.storage.local.get('debugLogs').then((result) => {
      setDebugLogs(result.debugLogs || []);
    });
  }, []);

  const patch = (partial: Partial<UserSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...partial });
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setError(null);
    try {
      const res = await updateSettings(settings);
      setSettings(res.payload);
      setSaved(true);
      setHasChanges(false);
      // Show saved state briefly
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[Options] Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleReset = () => {
    if (!settings) return;
    setSettings({ ...defaultSettings });
    setHasChanges(true);
    setSaved(false);
  };

  const handleViewLogs = () => {
    chrome.storage.local.get('debugLogs').then((result) => {
      setDebugLogs(result.debugLogs || []);
      setShowLogs(true);
    });
  };

  const handleClearLogs = () => {
    chrome.storage.local.remove('debugLogs').then(() => {
      setDebugLogs([]);
    });
  };

  if (!settings) {
    return (
      <div className="ll-root flex min-h-screen items-center justify-center">
        <p className="ll-text-base ll-text-secondary">Loading settings…</p>
      </div>
    );
  }

  return (
    <ThemeWrapper theme={settings.theme}>
      <div className="ll-settings-page">
        <header className="ll-settings-header">
          <h1 className="ll-settings-header__title">{t('appName')} — {t('settings')}</h1>
          <p className="ll-settings-header__subtitle">
            Configure translation defaults and extension behavior. All data stays on your device.
          </p>
          <p className="ll-settings-header__version">Version 0.1.0</p>
        </header>

        <div className="ll-settings-status-row">
          <span className="ll-settings-status-row__text">
            {hasChanges ? 'You have unsaved changes' : 'All values match defaults'}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="ll-settings-status-row__reset ll-focus-ring"
          >
            ↺ Reset to defaults
          </button>
        </div>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">Languages</h2>
          <div className="ll-settings-field-group">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t('sourceLanguage')}
                value={settings.sourceLanguage}
                onChange={(e) => patch({ sourceLanguage: e.target.value })}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </Select>
              <Select
                label={t('targetLanguage')}
                value={settings.targetLanguage}
                onChange={(e) => patch({ targetLanguage: e.target.value })}
              >
                {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </section>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">Behavior</h2>
          <div className="ll-settings-field-group">
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">Popup behavior</label>
              <select
                value={settings.popupBehavior}
                onChange={(e) => patch({ popupBehavior: e.target.value as PopupBehavior })}
                className="ll-field ll-field--settings ll-focus-ring"
              >
                <option value="click-to-show">Show floating icon — click to translate</option>
                <option value="auto-show">Auto-translate on text selection</option>
              </select>
            </div>
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => patch({ theme: e.target.value as Theme })}
                className="ll-field ll-field--settings ll-focus-ring"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">Keyboard shortcut</label>
              <p className="ll-text-secondary">
                <kbd className="ll-kbd">Ctrl+Shift+L</kbd>{' '}
                (Mac: <kbd className="ll-kbd">⌘+Shift+L</kbd>)
                — customize in{' '}
                <code className="ll-text-xs">chrome://extensions/shortcuts</code>
              </p>
            </div>
          </div>
        </section>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">Translation</h2>
          <p className="ll-settings-section__description">
            LinguaLens uses the free MyMemory Translation API. Selected text is sent to MyMemory
            for translation. Optional dictionary lookups use the Free Dictionary API (English only).
          </p>
          <div className="ll-settings-field-group">
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">Email (for higher free translation quota)</label>
              <Input
                type="email"
                value={settings.myMemoryEmail}
                onChange={(e) => patch({ myMemoryEmail: e.target.value })}
                placeholder="you@example.com (optional)"
                autoComplete="email"
                className="ll-field--settings"
              />
              <span className="ll-settings-field__caption">
                MyMemory raises the daily free limit from ~5,000 to ~50,000 words per day when an
                email is provided. MyMemory does not send mail — it only uses this to track quota.
              </span>
            </div>
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">Hinglish translation mode</label>
              <select
                value={settings.hinglishTranslationMode || 'auto'}
                onChange={(e) => patch({ hinglishTranslationMode: e.target.value as 'auto' | 'gemini' | 'transliteration' })}
                className="ll-field ll-field--settings ll-focus-ring"
              >
                <option value="auto">Auto (prefer Gemini if available, otherwise transliterate)</option>
                <option value="gemini">Gemini API (best quality, requires API key)</option>
                <option value="transliteration">Transliteration (convert to Devanagari first)</option>
              </select>
              <span className="ll-settings-field__caption">
                Hinglish is romanized, code-mixed Hindi-English text (e.g., "yaar kal milte hain"). 
                Translation quality is best with a Gemini API key configured. Transliteration mode 
                converts Hinglish to Devanagari script before translation.
              </span>
            </div>
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">AI-Enhanced Translation</label>
              <select
                value={settings.aiEnhancedTranslation ? 'true' : 'false'}
                onChange={(e) => patch({ aiEnhancedTranslation: e.target.value === 'true' })}
                className="ll-field ll-field--settings ll-focus-ring"
              >
                <option value="false">Disabled (faster, no API quota usage)</option>
                <option value="true">Enabled (improves grammar and naturalness)</option>
              </select>
              <span className="ll-settings-field__caption">
                When enabled, translations are automatically polished by AI to fix grammar errors and unnatural phrasing. This adds latency and uses your FreeLLMAPI quota. Requires a FreeLLMAPI key configured.
              </span>
            </div>
          </div>
        </section>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">AI Features</h2>
          <p className="ll-settings-section__description">
            AI features use FreeLLMAPI (OpenAI-compatible) for text simplification, grammar correction,
            summarization, and rewriting.
          </p>
          <div className="ll-settings-field-group">
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">FreeLLMAPI Base URL (optional)</label>
              <input
                type="text"
                value={settings.freeLLMBaseUrl || ''}
                onChange={(e) => patch({ freeLLMBaseUrl: e.target.value })}
                placeholder="https://lingualens-proxy.onrender.com"
                autoComplete="off"
                className="ll-field ll-field--settings ll-focus-ring"
                style={{ display: 'block', width: '100%', minHeight: '40px' }}
              />
              <span className="ll-settings-field__caption">
                Leave empty to use the default proxy endpoint.
              </span>
            </div>
          </div>
        </section>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">Hinglish Translation (Gemini)</h2>
          <p className="ll-settings-section__description">
            Hinglish translation uses Google Gemini Flash API for best quality. Get a free API key from{' '}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ll-link"
            >
              AI Studio
            </a>
            .
          </p>
          <p className="ll-settings-field__caption">
            Note: Google may require you to link a billing account (no charges within free limits) to activate your key's quota. If you see a "quota exceeded" error after adding your key, visit console.cloud.google.com/billing and link a billing account to the same project, then generate a new key.
          </p>
          <div className="ll-settings-field-group">
            <div className="ll-settings-field">
              <label className="ll-settings-field__label">Gemini API Key</label>
              <input
                type="text"
                value={settings.geminiApiKey || ''}
                onChange={(e) => patch({ geminiApiKey: e.target.value })}
                placeholder="Enter your free Gemini API key"
                autoComplete="off"
                className="ll-field ll-field--settings ll-focus-ring"
                style={{ display: 'block', width: '100%', minHeight: '40px' }}
              />
              <span className="ll-settings-field__caption">
                Your API key is stored locally on your device and never shared.
              </span>
            </div>
          </div>
        </section>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">Debug Logs</h2>
          <p className="ll-settings-section__description">
            View translation debug logs to troubleshoot issues. Logs are stored locally and persist across service worker restarts.
          </p>
          <div className="ll-settings-field-group">
            <div className="flex gap-2">
              <Button variant="settings" onClick={() => void handleViewLogs()}>
                Show Debug Logs
              </Button>
              <Button variant="settings" onClick={() => void handleClearLogs()}>
                Clear Logs
              </Button>
            </div>
            {showLogs && (
              <div className="mt-4">
                <h3 className="ll-text-base font-semibold mb-2">Last 20 Log Entries</h3>
                {debugLogs.length === 0 ? (
                  <p className="ll-text-secondary">No debug logs available.</p>
                ) : (
                  <div className="ll-card-section max-h-96 overflow-y-auto">
                    {debugLogs.slice(-20).map((log, index) => (
                      <div key={index} className="ll-text-sm mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="ll-text-xs ll-text-disabled mb-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div className="font-semibold">{log.event}</div>
                        <pre className="ll-text-xs ll-text-secondary mt-1 whitespace-pre-wrap">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="ll-settings-section">
          <h2 className="ll-settings-section__title">Privacy</h2>
          <ul className="list-inside list-disc space-y-2 ll-text-base ll-text-secondary">
            <li>No analytics or tracking by default.</li>
            <li>Translation history and vocabulary stay local on your device.</li>
            <li>Selected text is sent only to your configured translation/AI provider.</li>
            <li>Third-party API providers may log requests per their own policies.</li>
          </ul>
        </section>

        {error && (
          <div className="ll-banner ll-banner--error ll-animate-slide-up mb-4">
            <span className="mr-2" aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}

        <div className="ll-settings-footer">
          <div className="ll-settings-footer-content">
            <span className="ll-settings-footer__status">
              {saved ? 'All changes saved' : hasChanges ? 'Unsaved changes' : 'No changes'}
            </span>
            <Button 
              variant="settings" 
              disabled={!hasChanges}
              onClick={() => void handleSave()}
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </ThemeWrapper>
  );
}
