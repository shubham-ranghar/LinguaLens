# Web Store Readiness Checklist

## Manifest Permissions Review

### Current Permissions
```typescript
permissions: ['storage', 'activeTab', 'scripting']
host_permissions: ['https://*/*', 'http://*/*']
```

### Permission Justification

✅ **storage** - Required for:
- Saving user settings (target language, theme, API keys)
- Translation cache
- History and vocabulary storage
- Debug mode flag

✅ **activeTab** - Required for:
- Accessing selected text on the current tab
- Injecting content scripts for translation popup
- Keyboard shortcut command execution

✅ **scripting** - Required for:
- Dynamically injecting content scripts (though WXT may handle this via manifest.json)
- Future features like page-specific script injection

⚠️ **host_permissions: ['https://*/*', 'http://*/*']** - Required for:
- Content script injection on all HTTP(S) pages
- Text selection detection
- Translation popup rendering

**Assessment:** Permissions are minimal and justified for the extension's core functionality. The broad host permissions are necessary because the extension needs to work on any webpage where text is selected.

### Recommendations

1. **Consider optional_host_permissions** for stricter privacy:
   - Users could opt-in to specific sites
   - Better for privacy-conscious users
   - Trade-off: Requires user action to enable on new sites

2. **Document data transmission** in store listing:
   - Text selected by user is sent to MyMemory API for translation
   - Optional: Text sent to Google Gemini API for AI features (if user provides API key)
   - No other data leaves the browser

3. **Add privacy policy** - Required since extension transmits user text to third-party APIs:
   - MyMemory API: Free tier, no account required
   - Google Gemini API: User-provided API key, stored locally
   - Data retention: No data stored by extension beyond cache/history

---

## Store Listing Requirements

### Chrome Web Store
- [x] Manifest V3 compliant
- [x] Permissions documented and justified
- [ ] Privacy policy URL (needs to be published)
- [ ] Screenshots (1280x800 or 640x400)
- [ ] Promotional images (440x280, 920x680)
- [ ] Detailed description
- [ ] Privacy practices disclosure

### Firefox Add-ons
- [x] Manifest V3 compliant
- [x] Permissions documented
- [ ] Privacy policy URL
- [ ] Screenshots
- [ ] Detailed description
- [ ] Content security policy review

### Edge Add-ons
- [x] Manifest V3 compliant
- [x] Permissions documented
- [ ] Privacy policy URL
- [ ] Screenshots
- [ ] Detailed description

---

## Icon Requirements

### Current Icons
```typescript
icons: {
  16: '/icon16.png',
  32: '/icon32.png',
  48: '/icon48.png',
  128: '/icon128.png',
  256: '/icon256.png',
}
```

### Chrome Web Store Requirements
- 16x16 (favicon)
- 48x48 (extension management page)
- 128x128 (Chrome Web Store)
- ✅ All sizes present

### Firefox Requirements
- 16x16, 32x32, 48x48, 64x64, 128x128
- ⚠️ Missing 64x64 icon

### Edge Requirements
- 16x16, 32x32, 48x48, 128x128
- ✅ All sizes present

**Action:** Add 64x64 icon for Firefox support.

---

## Bundle Size Analysis

### Current Status
- Estimated bundle size: ~918KB (mentioned in original prompt)
- This is on the larger side for a content-script-heavy extension

### Optimization Recommendations

1. **Code-splitting** (WXT should handle this automatically):
   - Content script bundle should be minimal (injected into every page)
   - Popup/options bundles can be larger (loaded on-demand)
   - Verify WXT configuration for optimal splitting

2. **Dependencies review**:
   - `franc`: ~200KB - Required for language detection
   - `react`: ~40KB - Required for UI
   - `react-dom`: ~40KB - Required for UI
   - `wxt`: Build tool, not included in bundle

3. **Tree-shaking**:
   - Ensure unused franc language models are excluded
   - Tailwind CSS purging should remove unused styles

4. **Compression**:
   - WXT should produce gzipped bundles
   - Verify build output size after compression

---

## Keyboard Shortcut Conflict Check

### Current Shortcut
```typescript
'Ctrl+Shift+L' (Windows/Linux)
'Command+Shift+L' (macOS)
```

### Potential Conflicts
- **Chrome**: No default conflict
- **Firefox**: No default conflict
- **Edge**: No default conflict
- **macOS**: No default system conflict

**Assessment:** Shortcut is safe and doesn't conflict with browser/OS defaults.

---

## CSP (Content Security Policy) Review

### Current CSP
```typescript
extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://api.mymemory.translated.net https://generativelanguage.googleapis.com"
```

### Analysis
✅ **script-src 'self'** - Only allows scripts from extension itself
✅ **object-src 'self'** - Only allows objects from extension itself
✅ **connect-src** - Explicitly allows only required APIs:
  - MyMemory API (translation)
  - Google Generative Language API (AI features)

**Assessment:** CSP is properly restrictive and only allows necessary external connections.

---

## Privacy Policy Requirements

### Required Content
Since the extension transmits user text to third-party APIs, a privacy policy is required:

1. **Data Collection**:
   - Selected text sent to MyMemory API for translation
   - Optional: Text sent to Google Gemini API for AI features (user-provided API key)
   - No personal data collected

2. **Data Storage**:
   - Translation cache (stored locally in browser)
   - History and vocabulary (stored locally in browser)
   - User settings (stored locally in browser)
   - API keys (stored locally in browser)

3. **Data Sharing**:
   - MyMemory API: Text sent for translation, no account required
   - Google Gemini API: Text sent only if user provides API key
   - No data shared with third parties beyond these APIs

4. **Data Retention**:
   - Extension stores data locally until user clears it
   - MyMemory API: Check their privacy policy for data retention
   - Google Gemini API: Check their privacy policy for data retention

5. **User Rights**:
   - User can clear history/cache at any time
   - User can delete vocabulary entries
   - User can remove API keys
   - User can uninstall extension to remove all data

### Action Items
- [ ] Create privacy policy page
- [ ] Host privacy policy (GitHub Pages, extension website, etc.)
- [ ] Add privacy policy URL to manifest
- [ ] Add privacy policy link in store listing

---

## Testing Checklist

### Pre-Submission Testing
- [ ] Test on clean browser profile (no other extensions)
- [ ] Test on Chrome, Firefox, Edge
- [ ] Test keyboard shortcut (Ctrl+Shift+L / Cmd+Shift+L)
- [ ] Test text selection on various websites
- [ ] Test translation with different language pairs
- [ ] Test AI features (if API key provided)
- [ ] Test settings page
- [ ] Test popup and options pages
- [ ] Test Shadow DOM popup on pages with aggressive CSS
- [ ] Test on pages with CSP restrictions
- [ ] Test offline behavior (should show error, not crash)

### Language Testing Matrix
Test at minimum these language pairs:
- [ ] Arabic → English
- [ ] Hindi → English
- [ ] Mandarin → English
- [ ] Japanese → English
- [ ] Korean → English
- [ ] Russian → English
- [ ] Spanish → English
- [ ] French → English
- [ ] German → English
- [ ] Portuguese → English
- [ ] Turkish → English
- [ ] Vietnamese → English
- [ ] Thai → English

### Edge Cases
- [ ] Single word translation
- [ ] Short phrase (2-4 words)
- [ ] Long text (5000 chars max)
- [ ] Mixed script text
- [ ] Numbers and special characters
- [ ] Empty selection
- [ ] Same-language detection
- [ ] API rate limiting behavior
- [ ] API offline behavior

---

## Store-Specific Requirements

### Chrome Web Store
- [ ] Privacy policy URL
- [ ] Detailed description (min 80 characters)
- [ ] Screenshots (min 1, max 5)
- [ ] Promotional images (optional but recommended)
- [ ] Category: Productivity > Education
- [ ] Language: English (add translations for broader reach)

### Firefox Add-ons
- [ ] Privacy policy URL
- [ ] Detailed description
- [ ] Screenshots (min 1, max 5)
- [ ] Category: Education
- [ ] License: MPL-2.0 (recommended for Firefox)
- [ ] Add 64x64 icon

### Edge Add-ons
- [ ] Privacy policy URL
- [ ] Detailed description
- [ ] Screenshots (min 1, max 5)
- [ ] Category: Productivity
- [ ] Age rating: General audience

---

## Action Items Summary

### High Priority
1. Add 64x64 icon for Firefox support
2. Create and publish privacy policy
3. Add privacy policy URL to manifest
4. Test on clean browser profile

### Medium Priority
5. Create store screenshots (1280x800 or 640x400)
6. Create promotional images (440x280, 920x680)
7. Write detailed store descriptions
8. Test language matrix (12+ language pairs)

### Low Priority
9. Consider optional_host_permissions for stricter privacy
10. Add license file (MPL-2.0 for Firefox)
11. Add translations for store listing
12. Bundle size optimization audit

---

## Estimated Time to Store-Ready

- **Minimum viable submission:** 2-4 hours (privacy policy, icon, basic testing)
- **Full polished submission:** 8-12 hours (screenshots, descriptions, comprehensive testing)
