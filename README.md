# LinguaLens

A cross-browser Manifest V3 extension for instant translation, pronunciation, and language learning. Select any text on a webpage to translate it — built with **WXT**, **React**, **TypeScript**, and **Tailwind CSS**.

## Why WXT?

[WXT](https://wxt.dev/) was chosen over raw Vite + `@crxjs/vite-plugin` because it provides:

- Built-in **multi-browser targets** (Chrome, Firefox, Safari conversion path)
- **React module** with hot reload for popup/options/content UI
- **Shadow DOM content script UI** helpers (`createShadowRootUi`)
- Unified manifest generation from TypeScript (`manifest.config.ts`)

## Features (Phase 1 MVP)

- **Text selection detection** — floating 🌐 button appears near your selection
- **Translation popup** — Shadow DOM-isolated UI with source/target language controls
- **Text-to-speech** — Web Speech API pronunciation (swappable for cloud TTS later)
- **Settings page** — default languages, popup behavior, theme, API key/proxy config
- **Translation history** — searchable local history in the toolbar popup
- **Keyboard shortcut** — `Ctrl+Shift+L` / `⌘+Shift+L` to translate selection

Phase 2/3 UI slots (Save to vocabulary, Simplify, Grammar, etc.) are stubbed and disabled.

## Project structure

```
src/
  background/        Service worker logic (API, messaging, cache)
  content/           Selection detection + Shadow DOM mount
  popup/             Toolbar popup React app
  options/           Settings page React app
  components/        Shared UI (SelectionPopup, buttons, cards)
  lib/
    api/             TranslationProvider interface + mock impl
    storage/         chrome.storage wrappers
    i18n/            Extension UI strings
  types/             Shared types + typed message contract
  entrypoints/       WXT entry files
  assets/            Tailwind CSS
manifest.config.ts   MV3 manifest definition
wxt.config.ts        WXT build config
```

## Permissions tradeoff

| Approach | Pros | Cons |
|----------|------|------|
| **`activeTab` only** | Minimal permission prompt | Selection UI only works after user invokes extension on that tab |
| **`https://*/*` content script** (current) | Always-on selection UX | Requires host access to HTTP(S) pages |

LinguaLens uses `storage`, `activeTab`, `scripting`, and content scripts on `https://*/*` + `http://*/*` so the floating translate button works immediately on any page. API keys are stored in `chrome.storage.local` (not synced); other settings use `chrome.storage.sync`.

## Development

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn)

### Install & run

```bash
npm install
npm run dev
```

WXT opens a browser with the extension loaded. Output is in `.output/chrome-mv3/`.

### Build for production

```bash
npm run build
```

Load the unpacked extension from `.output/chrome-mv3/`.

## Load unpacked in Chrome / Brave

1. Run `npm run build` (or use `.output/chrome-mv3` from `npm run dev`)
2. Open `chrome://extensions` (Brave: `brave://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `.output/chrome-mv3` folder

### Pin the extension

Click the puzzle icon → pin **LinguaLens** for quick access to history.

## Wire up a real translation API

The default provider is a **mock** in `src/lib/api/translation.ts`. To integrate your provider:

1. Implement `TranslationProvider` interface
2. Replace `defaultTranslationProvider` in the same file (or select by settings)
3. Add your API key in **Settings → Translation API**, or configure a backend proxy URL

Never commit API keys. Prefer a server-side proxy so keys stay off the client.

## Keyboard shortcut

Default: `Ctrl+Shift+L` (Mac: `⌘+Shift+L`). Customize at `chrome://extensions/shortcuts`.

## Safari conversion

See [SAFARI.md](./SAFARI.md) for Xcode conversion steps and known MV3 gaps.

## Privacy

- No analytics by default
- History and vocabulary stay local
- Selected text is sent only to your configured translation provider
- Third-party APIs may log requests per their own policies

## License

ISC
