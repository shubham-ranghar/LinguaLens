# LinguaLens — Safari Web Extension Conversion

This document describes how to convert the Chromium MV3 build to Safari with minimal changes.

## Prerequisites

- macOS with Xcode 14+
- Apple Developer account (for distribution; not required for local testing)
- Built extension: `npm run build` → `.output/chrome-mv3/`

## Conversion steps

### 1. Build the Chromium extension

```bash
npm run build
```

### 2. Run Apple's converter

```bash
xcrun safari-web-extension-converter .output/chrome-mv3 \
  --app-name LinguaLens \
  --bundle-identifier com.yourcompany.lingualens \
  --swift \
  --copy-resources
```

This creates an Xcode project wrapping the web extension.

### 3. Open in Xcode

```bash
open LinguaLens/LinguaLens.xcodeproj
```

Select the **LinguaLens Extension** target → **Signing & Capabilities** → set your Team.

### 4. Run

Choose the **LinguaLens** scheme and run on macOS. Safari will load the embedded extension.

### 5. Enable in Safari

Safari → Settings → Extensions → enable **LinguaLens**.

## Known MV3 gaps in Safari

| Feature | Chrome/Brave | Safari | Mitigation in LinguaLens |
|---------|--------------|--------|--------------------------|
| Service worker lifecycle | Standard MV3 SW | May terminate more aggressively | Stateless handlers; cache in `chrome.storage` |
| `chrome.action` | Supported | Supported as `browser.action` | WXT abstracts via `browser.*` polyfill |
| `chrome.storage.sync` | Google account sync | iCloud sync (different quota) | Graceful fallback to local storage |
| `chrome.commands` | Supported | Limited / requires macOS app wrapper | Shortcut may need Safari app menu; test after conversion |
| `speechSynthesis` in content scripts | Works | Generally works | Same Web Speech API; test voice availability |
| Shadow DOM UI | Full support | Supported | Uses standard Shadow DOM via WXT `createShadowRootUi` |
| `host_permissions` | Declared in manifest | Converted by Apple tool | Review converted Info.plist permissions |

## Code patterns that avoid Safari breakage

1. **No Chrome-only APIs** — we avoid `chrome.sidePanel`, `chrome.debugger`, etc.
2. **WXT browser abstraction** — build with `wxt`; use `browser.*` namespace where WXT emits it
3. **Feature detection** — TTS checks `'speechSynthesis' in window` before speaking
4. **Minimal permissions** — only `storage`, `activeTab`, `scripting`, and HTTP(S) host patterns

## Optional: WXT Firefox/Safari targets

WXT supports browser-specific builds:

```bash
npm run build:firefox
```

For Safari, the Apple converter remains the recommended path rather than a separate WXT target.

## Testing checklist after conversion

- [ ] Text selection shows floating 🌐 button
- [ ] Translation popup renders inside Shadow DOM (no host CSS bleed)
- [ ] Settings persist (target language, theme)
- [ ] History appears in popup
- [ ] Keyboard shortcut triggers translation (if supported on macOS)
- [ ] TTS pronunciation button speaks translated text
- [ ] Offline / error states display correctly

## Distribution

For Mac App Store distribution, follow Apple's [Safari Web Extension packaging guidelines](https://developer.apple.com/documentation/safariservices/safari_web_extensions).

## Reporting Safari-specific issues

If you find Safari-only bugs, note:

- macOS / Safari version
- Steps to reproduce
- Whether the issue occurs in Chrome with the same build logic

File issues with the `safari` label for tracking platform-specific shims.
