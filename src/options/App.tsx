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

  useEffect(() => {
    logger.debug('Loading settings...');
    fetchSettings()
      .then((res) => {
        logger.debug('Settings loaded:', res.payload);
        setSettings(res.payload);
      })
      .catch((err) => {
        logger.error('Failed to load settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      });
  }, []);

  const patch = (partial: Partial<UserSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...partial });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setError(null);
    try {
      const res = await updateSettings(settings);
      setSettings(res.payload);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
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
      <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
        <h1 className="ll-text-xl mb-2 font-bold">{t('appName')} — {t('settings')}</h1>
        <p className="ll-text-base ll-text-secondary mb-8">
          Configure translation defaults and extension behavior. All data stays on your device.
        </p>

        <section className="ll-section mb-8 space-y-4">
          <h2 className="ll-text-lg font-semibold">Languages</h2>
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
        </section>

        <section className="ll-section mb-8 space-y-4">
          <h2 className="ll-text-lg font-semibold">Behavior</h2>
          <label className="ll-field-label">
            <span>Popup behavior</span>
            <select
              value={settings.popupBehavior}
              onChange={(e) => patch({ popupBehavior: e.target.value as PopupBehavior })}
              className="ll-field ll-focus-ring"
            >
              <option value="click-to-show">Show floating icon — click to translate</option>
              <option value="auto-show">Auto-translate on text selection</option>
            </select>
          </label>
          <label className="ll-field-label">
            <span>Theme</span>
            <select
              value={settings.theme}
              onChange={(e) => patch({ theme: e.target.value as Theme })}
              className="ll-field ll-focus-ring"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="ll-field-label">
            <span>Keyboard shortcut</span>
            <p className="ll-text-secondary">
              <kbd className="ll-kbd">Ctrl+Shift+L</kbd>{' '}
              (Mac: <kbd className="ll-kbd">⌘+Shift+L</kbd>)
              — customize in{' '}
              <code className="ll-text-xs">chrome://extensions/shortcuts</code>
            </p>
          </label>
        </section>

        <section className="ll-section mb-8 space-y-4">
          <h2 className="ll-text-lg font-semibold">Translation</h2>
          <p className="ll-text-base ll-text-secondary">
            LinguaLens uses the free MyMemory Translation API. Selected text is sent to MyMemory
            for translation. Optional dictionary lookups use the Free Dictionary API (English only).
          </p>
          <label className="ll-field-label">
            <span>Email (for higher free translation quota)</span>
            <Input
              type="email"
              value={settings.myMemoryEmail}
              onChange={(e) => patch({ myMemoryEmail: e.target.value })}
              placeholder="you@example.com (optional)"
              autoComplete="email"
            />
            <span className="ll-text-xs ll-text-secondary">
              MyMemory raises the daily free limit from ~5,000 to ~50,000 words per day when an
              email is provided. MyMemory does not send mail — it only uses this to track quota.
            </span>
          </label>
        </section>

        <section className="ll-section mb-8 space-y-4">
          <h2 className="ll-text-lg font-semibold">AI Features</h2>
          <p className="ll-text-base ll-text-secondary">
            AI features use Google Gemini Flash API for text simplification, grammar correction,
            summarization, and rewriting. Get a free API key from{' '}
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
          <p className="ll-text-xs ll-text-secondary">
            Note: Google may require you to link a billing account (no charges within free limits) to activate your key's quota. If you see a "quota exceeded" error after adding your key, visit console.cloud.google.com/billing and link a billing account to the same project, then generate a new key.
          </p>
          <label className="ll-field-label">
            <span>Gemini API Key</span>
            <input
              type="text"
              value={settings.geminiApiKey || ''}
              onChange={(e) => patch({ geminiApiKey: e.target.value })}
              placeholder="Enter your free Gemini API key"
              autoComplete="off"
              className="ll-field ll-focus-ring"
              style={{ display: 'block', width: '100%', minHeight: '36px' }}
            />
            <span className="ll-text-xs ll-text-secondary">
              Your API key is stored locally on your device and never shared.
            </span>
          </label>
        </section>

        <section className="ll-section mb-8">
          <h2 className="ll-text-lg mb-2 font-semibold">Privacy</h2>
          <ul className="list-inside list-disc space-y-1 ll-text-base ll-text-secondary">
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

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => void handleSave()}>
            Save settings
          </Button>
          {saved && <span className="ll-text-base ll-text-success ll-animate-fade-in">Saved!</span>}
        </div>
      </div>
    </ThemeWrapper>
  );
}
