import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from '@/options/App';
import { getSettings } from '@/lib/storage';
import { applyThemeToRoot, initTheme } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { Theme } from '@/types';
import '@/assets/tailwind.css';

async function initOptions() {
  logger.debug('options', { action: 'initializing' });
  const root = document.getElementById('root');
  if (!root) {
    logger.error('options', { action: 'no-root-element' });
    return;
  }

  let currentTheme: Theme = 'system';
  let cleanupThemeWatcher: (() => void) | null = null;

  try {
    // Apply theme before first paint to avoid flash
    logger.debug('options', { action: 'loading-settings' });
    const settings = await getSettings();
    logger.debug('options', { action: 'settings-loaded', settings });
    const initialTheme = settings.theme;
    currentTheme = initialTheme;
    cleanupThemeWatcher = initTheme(root, () => currentTheme);
  } catch (err) {
    logger.error('options', { action: 'settings-load-failed', error: err instanceof Error ? err.message : String(err) });
    // Continue with default theme even if settings fail
    cleanupThemeWatcher = initTheme(root, () => 'system');
  }

  const handleStorageChange = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area !== 'sync' || !changes.lingualens_settings?.newValue) return;
    const updated = changes.lingualens_settings.newValue as Partial<{ theme: Theme }>;
    if (!updated.theme) return;
    currentTheme = updated.theme;
    applyThemeToRoot(root, currentTheme);
  };
  chrome.storage.onChanged.addListener(handleStorageChange);

  logger.debug('options', { action: 'rendering-react' });
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>,
  );
  logger.debug('options', { action: 'react-rendered' });

  // Cleanup on unmount
  window.addEventListener('unload', () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
    cleanupThemeWatcher?.();
  });
}

initOptions();
