/**
 * LinguaLens MV3 manifest definition.
 *
 * Permission tradeoff: always-on text selection requires content scripts on web pages.
 * We use https/http matches (not <all_urls>) and declare host_permissions for HTTP(S).
 * For stricter privacy, users can later switch to optional_host_permissions + opt-in.
 */
export function defineLinguaLensManifest() {
  return {
    name: 'LinguaLens',
    description:
      'Select text on any page for instant translation, pronunciation, and language learning.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['https://*/*', 'http://*/*'],
    action: {
      default_title: 'LinguaLens',
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    commands: {
      'translate-selection': {
        suggested_key: {
          default: 'Ctrl+Shift+L',
          mac: 'Command+Shift+L',
        },
        description: 'Translate current text selection',
      },
    },
  };
}

export type LinguaLensManifest = ReturnType<typeof defineLinguaLensManifest>;
