# LinguaLens Privacy Policy

**Last Updated:** July 3, 2026

## Overview

LinguaLens is a browser extension that provides instant translation for selected text on web pages. We are committed to protecting your privacy and being transparent about how we handle your data.

## Data Collection

### What We Collect

**Selected Text**
- When you select text on a webpage and request a translation, that text is sent to our translation API provider (MyMemory) to process your request
- The text is not stored by LinguaLens unless you explicitly save it to your translation history or vocabulary

**Translation History**
- Your translation history is stored locally on your device using Chrome's storage API
- History entries include: original text, translated text, source language, target language, and timestamp
- This data never leaves your device unless you choose to sync it (not currently implemented)

**Vocabulary**
- Words and phrases you save to your vocabulary list are stored locally on your device
- Vocabulary entries include: source text, translated text, target language, tags, and save timestamp
- This data never leaves your device

**Settings**
- Your extension settings (default languages, theme, popup behavior) are stored locally
- API keys (MyMemory email, Gemini API key) are stored locally and never synced
- Settings that don't contain sensitive data may be synced across your devices if you're signed into Chrome

### What We Don't Collect

- **Personal identification information** - We don't collect your name, email address, or any other personally identifiable information
- **Browsing history** - We don't track which websites you visit or what you read
- **Analytics** - We don't use any analytics or tracking services
- **Cookies** - We don't set or use cookies
- **Location data** - We don't collect or use your location information

## Third-Party Services

### MyMemory Translation API

- LinguaLens uses the MyMemory Translation API (api.mymemory.translated.net) to provide translations
- When you translate text, your selected text is sent to MyMemory's servers
- MyMemory may log translation requests according to their own privacy policy
- We do not have control over MyMemory's data practices
- You can provide your MyMemory email address in settings to increase your daily translation limit (from 5,000 to 50,000 words/day)
- Your email address is stored locally on your device and never shared with us

### Gemini AI API (Optional)

- AI features (simplify, grammar correction, summarize, rewrite) use Google's Gemini API
- When you use AI features, your selected text is sent to Google's servers
- Google may process your text according to their privacy policy
- You must provide your own Gemini API key to use these features
- Your API key is stored locally on your device and never shared with us

## Data Storage

### Local Storage

All data is stored locally on your device using Chrome's storage API:
- Translation history
- Vocabulary lists
- Extension settings
- API keys

### Data Retention

- Translation history: Stored until you manually clear it
- Vocabulary: Stored until you manually delete entries
- Settings: Stored until you uninstall the extension
- API keys: Stored until you uninstall the extension or remove them from settings

### Data Deletion

You can delete your data at any time:
- **Clear translation history**: Open the extension popup → History tab → Clear History
- **Delete vocabulary entries**: Open the extension popup → Vocabulary tab → Delete individual entries
- **Remove API keys**: Open Settings → Translation API → Remove your API keys
- **Uninstall extension**: All local data will be automatically cleared when you uninstall LinguaLens

## Data Sharing

We do not sell, rent, or share your data with third parties for marketing or advertising purposes.

The only data shared with third parties is:
- Selected text sent to MyMemory for translation (required for the service to function)
- Selected text sent to Google Gemini for AI features (required when you use those features)

## Security

- API keys are stored locally using Chrome's storage.local API (not synced to the cloud)
- All communication with third-party APIs uses HTTPS encryption
- The extension uses Content Security Policy (CSP) to restrict network requests to approved domains only
- The extension does not execute arbitrary code from external sources

## Children's Privacy

LinguaLens is not intended for children under 13. We do not knowingly collect personal information from children under 13.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. We will notify users of significant changes by updating the date at the top of this policy.

## Contact

If you have questions about this privacy policy or how we handle your data, please contact us through the GitHub repository: https://github.com/shubham-ranghar/LinguaLens/issues
