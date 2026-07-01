import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from '@/options/App';
import { getSettings } from '@/lib/storage';
import { applyThemeToRoot, initTheme } from '@/lib/utils';
import type { Theme } from '@/types';
import '@/assets/tailwind.css';

async function initOptions() {
  const root = document.getElementById('root');
  if (!root) return;

  // Apply theme before first paint to avoid flash
  const settings = await getSettings();
  const initialTheme = settings.theme;
  let currentTheme: Theme = initialTheme;
  const cleanupThemeWatcher = initTheme(root, () => currentTheme);

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

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>,
  );

  // Cleanup on unmount
  window.addEventListener('unload', () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
    cleanupThemeWatcher();
  });
}

initOptions();
