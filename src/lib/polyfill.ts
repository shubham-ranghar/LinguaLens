/**
 * WebExtension polyfill for cross-browser compatibility.
 * Uses browser.* namespace in Firefox/Safari, falls back to chrome.* in Chrome/Edge/Brave.
 * Currently unused - kept for future Firefox/Safari support.
 * 
 * To enable Firefox/Safari support:
 * 1. Uncomment the import below
 * 2. Add webextension-polyfill to dependencies: npm install webextension-polyfill
 * 3. Replace chrome.* API calls with browser.* in the codebase
 */
// import browser from 'webextension-polyfill';
// export default browser;
