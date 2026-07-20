import { initBackground } from '@/background';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/lib/storage/constants';

export default defineBackground(() => {
  // Initialize default settings on install
  chrome.runtime.onInstalled.addListener(async () => {
    const existing = await chrome.storage.sync.get(STORAGE_KEYS.settingsSync);
    if (!existing[STORAGE_KEYS.settingsSync]) {
      const { myMemoryEmail, geminiApiKey, freeLLMBaseUrl, ...synced } = DEFAULT_SETTINGS;
      await chrome.storage.sync.set({ [STORAGE_KEYS.settingsSync]: synced });
      await chrome.storage.local.set({
        [STORAGE_KEYS.myMemoryEmail]: myMemoryEmail,
        [STORAGE_KEYS.geminiApiKey]: geminiApiKey,
        [STORAGE_KEYS.freeLLMBaseUrl]: freeLLMBaseUrl,
      });
    }
    
    // Set uninstall URL for feedback
    chrome.runtime.setUninstallURL('https://github.com/shubham-ranghar/LinguaLens/issues');
  });

  initBackground();
});
