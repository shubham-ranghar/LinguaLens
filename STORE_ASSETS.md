# Chrome Web Store Listing Assets

## Store Listing Information

### Short Description (132 characters max)
Select text on any page for instant translation, pronunciation, and language learning.

### Detailed Description

LinguaLens is a powerful browser extension that provides instant translation, pronunciation, and language learning tools right where you need them — on any webpage.

**Core Features:**
- **Instant Translation**: Select any text on a webpage and get instant translations in over 100 languages
- **Smart Language Detection**: Automatically detects the source language for seamless translation
- **Text-to-Speech**: Listen to pronunciations of translated text using built-in browser speech synthesis
- **Translation History**: Keep track of your translations with searchable local history
- **Vocabulary Builder**: Save words and phrases to your personal vocabulary list for later review
- **Keyboard Shortcut**: Use Ctrl+Shift+L (Mac: ⌘+Shift+L) to quickly translate selections
- **Dark/Light Theme**: Choose between system, light, or dark themes for comfortable viewing

**AI-Powered Features (Optional):**
- Text Simplification: Make complex text easier to understand
- Grammar Correction: Fix grammar mistakes with AI assistance
- Summarization: Get concise summaries of long text
- Text Rewriting: Rewrite text in different tones (formal, casual, concise)

**Privacy & Security:**
- All data stays on your device — translation history and vocabulary are stored locally
- No analytics or tracking by default
- API keys are stored locally and never synced
- Selected text is only sent to your configured translation/AI providers
- Open source and transparent

**How It Works:**
1. Select text on any webpage
2. Click the floating 🌐 button that appears
3. View instant translation with definitions, synonyms, and examples
4. Save to vocabulary, listen to pronunciation, or use AI features

Perfect for language learners, researchers, and anyone who reads content in multiple languages.

### Category
**Primary**: Productivity
**Secondary**: Education

### Language
English (en)

### Version
0.1.0

### Developer Information
**Developer Name**: Shubham Ranghar
**Developer Website**: https://github.com/shubham-ranghar/LinguaLens-
**Support Email**: Use GitHub Issues for support
**Privacy Policy**: https://github.com/shubham-ranghar/LinguaLens-/blob/main/PRIVACY.md

### Screenshots Required

You need to create the following screenshots (1280x800 or 640x400 pixels):

1. **Main Feature - Text Selection**: Show the floating 🌐 button appearing next to selected text on a webpage
2. **Translation Popup**: Display the translation popup with translated text, language controls, and action buttons
3. **History Tab**: Show the popup's history tab with translation history entries
4. **Vocabulary Tab**: Display the vocabulary list with saved words and review mode
5. **Settings Page**: Show the options/settings page with language preferences and API key configuration
6. **AI Features**: Demonstrate AI features like simplify, grammar check, or summarize in action

**Screenshot Tips:**
- Use a clean, professional webpage as the background (e.g., Wikipedia, news article)
- Ensure the extension UI is clearly visible and not obscured
- Highlight key features with subtle visual cues
- Maintain consistent styling across all screenshots
- Include the browser window frame to show context

### Promotional Image (440x280)

Create a promotional image featuring:
- The LinguaLens logo/icon
- A tagline: "Instant Translation, Anywhere"
- A visual showing text selection and translation
- Clean, modern design with good contrast

### Store Listing Checklist

- [x] Short description (≤132 characters)
- [x] Detailed description
- [x] Category: Productivity
- [x] Language: English
- [x] Version: 0.1.0
- [x] Developer information
- [x] Privacy policy URL in manifest
- [ ] Screenshots (minimum 1, recommended 5)
- [ ] Promotional image (440x280)
- [ ] Icons (16, 32, 48, 128, 256) - ✅ Already present
- [ ] License information in listing

### Additional Notes

**Permissions Explanation for Users:**
The extension requests the following permissions:
- **Storage**: To save your settings, translation history, and vocabulary locally
- **ActiveTab**: To access text selection on the current tab
- **Scripting**: To inject the content script for text selection detection
- **Host Permissions (https://*/*, http://*/*)**: To work on all websites so you can translate text anywhere

**Why Broad Host Permissions?**
LinguaLens needs to work on any website you visit to provide instant translation. The content script runs on all HTTP(S) pages to detect text selection and show the translation popup. This is necessary for the core functionality of the extension.

**Data Collection Notice:**
The extension collects:
- Selected text (sent to translation APIs only when you request translation)
- Translation history (stored locally on your device)
- Vocabulary list (stored locally on your device)
- Extension settings (stored locally, some synced across your devices)

All data is stored locally on your device. No personal information is collected or transmitted to our servers.
