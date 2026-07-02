/**
 * WebExtension polyfill for cross-browser compatibility.
 * Uses browser.* namespace in Firefox/Safari, falls back to chrome.* in Chrome/Edge/Brave.
 */
import browser from 'webextension-polyfill';

// Export the polyfilled browser API
export default browser;
