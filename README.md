# LinguaLens

A cross-browser Manifest V3 extension for instant translation, pronunciation, and language learning. Select any text on a webpage to translate it — built with **WXT**, **React**, **TypeScript**, and **Tailwind CSS**.

**Repository:** [github.com/shubham-ranghar/LinguaLens](https://github.com/shubham-ranghar/LinguaLens)

## Features

- **Text selection detection** — floating translate button near your selection (or auto-translate)
- **Translation popup** — Shadow DOM–isolated UI with source/target language controls
- **MyMemory translation** — free API by default; optional email raises daily word quota
- **Language detection** — auto-detect via `franc` plus heuristics (including Hinglish)
- **Hinglish support** — romanized Hindi–English via Gemini and/or Devanagari transliteration
- **Dictionary extras** — English definitions/synonyms via Free Dictionary API when available
- **AI tools** (optional) — simplify, grammar, summarize, rewrite via FreeLLM proxy; Hinglish via Gemini
- **AI-enhanced translation** — optional post-polish of translations (uses FreeLLM quota)
- **Text-to-speech** — Web Speech API pronunciation for translations
- **Vocabulary** — save words/phrases locally; review mode in the toolbar popup
- **Translation history** — searchable local history with page URL and timestamp
- **Quota awareness** — MyMemory usage status in the popup
- **Settings** — languages, popup behavior, theme, MyMemory email, Gemini key, FreeLLM base URL, debug logs
- **Keyboard shortcut** — `Ctrl+Shift+L` / `⌘+Shift+L` to translate the current selection

### Supported languages

Auto-detect, English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, Hindi, Dutch, Polish, Turkish, Vietnamese.

## Stack

| Piece | Choice |
|-------|--------|
| Extension framework | [WXT](https://wxt.dev/) (Chrome / Firefox MV3) |
| UI | React 19 + Tailwind CSS 4 |
| Language detection | `franc` |
| Translation | [MyMemory](https://mymemory.translated.net/) |
| Optional AI | FreeLLM proxy + [Google Gemini](https://aistudio.google.com) |
| Tests | Vitest |

## Project structure

```
src/
  background/          Service worker (messaging, cache, quota, translate)
  content/             Selection detection + Shadow DOM mount
  popup/               Toolbar popup (history, vocabulary, review, quota)
  options/             Settings page
  components/          SelectionPopup + shared UI
  lib/
    api/               MyMemory provider, AI features, post-processing
    detection/         Hinglish detection
    transliteration/   Hinglish → Devanagari
    storage/           chrome.storage wrappers
    i18n/              Extension UI strings
    messaging.ts       Typed popup/content ↔ background messages
  types/               Shared types + message contracts
  entrypoints/         WXT entry files (background, content, popup, options)
  assets/              Tailwind CSS
public/                Icons
manifest.config.ts     MV3 manifest
wxt.config.ts          WXT + Vite config
```

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Settings, history, vocabulary, cache, API keys |
| `activeTab` | Shortcut / action targeting the current tab |
| `scripting` | Page UI injection support |
| `http(s)://*/*` host | Always-on selection UI on web pages |

API keys and MyMemory email stay in `chrome.storage.local` (not synced). Non-sensitive settings use `chrome.storage.sync`.

## Development

### Prerequisites

- Node.js 18+
- npm

### Install & run

```bash
cp .env.example .env   # then fill in secrets / URLs
npm install
npm run dev          # Chrome
npm run dev:firefox  # Firefox
```

WXT loads the extension in a browser. Output: `.output/chrome-mv3/` (or Firefox equivalent).

### Build

```bash
npm run build          # Chrome MV3 → .output/chrome-mv3/
npm run build:firefox
npm run zip            # Packaged zip for store upload
npm run compile        # Typecheck only
```

### Tests

```bash
npx vitest
```

### Load unpacked (Chrome / Brave)

1. `npm run build`
2. Open `chrome://extensions` (Brave: `brave://extensions`)
3. Enable **Developer mode** → **Load unpacked**
4. Select `.output/chrome-mv3`

Pin LinguaLens from the puzzle menu for quick access to history and vocabulary.

## Configuration

Open **Options** (right-click the extension icon → Options):

| Setting | Purpose |
|---------|---------|
| Source / target language | Defaults for the selection popup |
| Popup behavior | Click floating icon, or auto-translate on select |
| Theme | System / light / dark |
| MyMemory email | Optional — higher free daily word limit |
| Hinglish mode | Auto / Gemini / transliteration |
| AI-enhanced translation | Optional polish via FreeLLM |
| FreeLLM base URL | Defaults to the LinguaLens proxy |
| Gemini API key | Best-quality Hinglish (stored locally) |

Never commit API keys or `.env`. Prefer user-supplied keys (Gemini) or a server-side proxy. Copy `.env.example` → `.env` for build-time URLs and the FreeLLM extension secret.

## Keyboard shortcut

Default: `Ctrl+Shift+L` (Mac: `⌘+Shift+L`). Customize at `chrome://extensions/shortcuts`.

## Privacy

See [PRIVACY.md](./PRIVACY.md).

- No analytics by default
- History and vocabulary stay on device
- Selected text is sent only to configured translation/AI providers (MyMemory, optional Gemini / FreeLLM)
- Privacy policy: https://github.com/shubham-ranghar/LinguaLens/blob/main/PRIVACY.md

## License

ISC
