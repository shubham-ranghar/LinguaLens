import { createRoot, type Root } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { FloatingTrigger, SelectionPopup } from '@/components/SelectionPopup';
import { fetchSettings } from '@/lib/messaging';
import { getSelectedText, getSelectionRect, initTheme } from '@/lib/utils';
import type { UserSettings } from '@/types';
import '@/assets/tailwind.css';

interface UiState {
  mode: 'hidden' | 'trigger' | 'popup';
  text: string;
  position: { top: number; left: number };
}

export function initContentScript(ctx: ContentScriptContext): void {
  let settings: UserSettings | null = null;
  let uiState: UiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
  let reactRoot: Root | null = null;
  let shadowUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
  let ignoreSelectionChange = false;
  let cleanupThemeWatcher: (() => void) | null = null;

  async function loadSettings(): Promise<UserSettings> {
    const response = await fetchSettings();
    settings = response.payload;
    return response.payload;
  }

  function getExtensionShadowHost(): HTMLElement | null {
    const container = shadowUi?.uiContainer;
    if (!container) return null;
    const root = container.getRootNode();
    if (root instanceof ShadowRoot) return root.host as HTMLElement;
    return container;
  }

  /** Shadow DOM retargets event.target; composedPath() is required for hit-testing. */
  function isEventInsideExtensionUi(event: Event): boolean {
    const container = shadowUi?.uiContainer;
    const host = getExtensionShadowHost();
    if (!container && !host) return false;

    const path = event.composedPath();
    if (host && path.includes(host)) return true;
    if (container && path.includes(container)) return true;
    return false;
  }

  function getTriggerPosition(rect: DOMRect): { top: number; left: number } {
    return {
      top: Math.max(8, rect.top - 44),
      left: Math.min(rect.right + 4, window.innerWidth - 44),
    };
  }

  function getPopupPosition(rect: DOMRect): { top: number; left: number } {
    const popupHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    
    // If there's not enough space below but enough above, position above the selection
    let top;
    if (spaceBelow < popupHeight && spaceAbove > popupHeight) {
      top = Math.max(8, rect.top - popupHeight - 8);
    } else {
      top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - popupHeight - 8));
    }
    
    return {
      top,
      left: Math.min(Math.max(rect.left, 8), window.innerWidth - 360),
    };
  }

  function renderUi(): void {
    if (!reactRoot || !settings) return;

    const { mode, text, position } = uiState;

    if (mode === 'hidden') {
      reactRoot.render(null);
      return;
    }

    if (mode === 'trigger') {
      reactRoot.render(
        <FloatingTrigger
          position={position}
          onClick={() => {
            ignoreSelectionChange = true;
            const rect = getSelectionRect();
            uiState = {
              ...uiState,
              mode: 'popup',
              position: rect ? getPopupPosition(rect) : uiState.position,
            };
            renderUi();
            window.setTimeout(() => {
              ignoreSelectionChange = false;
            }, 100);
          }}
        />,
      );
      return;
    }

    reactRoot.render(
      <SelectionPopup
        selectedText={text}
        position={position}
        settings={settings}
        onClose={() => {
          uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
          renderUi();
        }}
      />,
    );
  }

  async function ensureUiMounted(): Promise<void> {
    if (shadowUi) return;

    shadowUi = await createShadowRootUi(ctx, {
      name: 'lingualens-ui',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount(container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'll-root ll-root--host';
        container.append(wrapper);
        reactRoot = createRoot(wrapper);

        // Apply theme to the Shadow DOM root
        if (settings) {
          cleanupThemeWatcher = initTheme(wrapper, () => settings!.theme);
        }

        renderUi();
        return reactRoot;
      },
      onRemove(root) {
        cleanupThemeWatcher?.();
        cleanupThemeWatcher = null;
        (root as Root | null)?.unmount();
        reactRoot = null;
      },
    });

    shadowUi.mount();

    // Ensure events work properly in shadow DOM
    const shadowHost = shadowUi.uiContainer;
    if (shadowHost) {
      shadowHost.style.pointerEvents = 'auto';
    }
  }

  async function handleSelectionChange(): Promise<void> {
    if (ignoreSelectionChange) return;

    const text = getSelectedText();
    const rect = getSelectionRect();

    if (!text || !rect) {
      if (uiState.mode !== 'hidden') {
        uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
        renderUi();
      }
      return;
    }

    if (!settings) {
      try {
        await loadSettings();
      } catch {
        return;
      }
    }

    await ensureUiMounted();

    const behavior = settings!.popupBehavior;
    uiState = {
      mode: behavior === 'auto-show' ? 'popup' : 'trigger',
      text,
      position:
        behavior === 'auto-show' ? getPopupPosition(rect) : getTriggerPosition(rect),
    };
    renderUi();
  }

  async function openPopupForSelection(): Promise<void> {
    const text = getSelectedText();
    const rect = getSelectionRect();
    if (!text || !rect) return;

    if (!settings) await loadSettings();
    await ensureUiMounted();

    uiState = {
      mode: 'popup',
      text,
      position: getPopupPosition(rect),
    };
    renderUi();
  }

  document.addEventListener('mouseup', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    if (!ignoreSelectionChange) {
      window.setTimeout(() => void handleSelectionChange(), 10);
    }
  });

  document.addEventListener('keyup', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    if (!ignoreSelectionChange) {
      window.setTimeout(() => void handleSelectionChange(), 10);
    }
  });

  document.addEventListener('selectionchange', () => {
    if (ignoreSelectionChange) return;
    // Opening <select> and other popup controls clears page selection — don't close.
    if (uiState.mode === 'popup') return;

    const text = getSelectedText();
    if (!text && uiState.mode !== 'hidden') {
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  });

  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === 'TRIGGER_TRANSLATE') {
      void openPopupForSelection();
    }
  });

  void loadSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.lingualens_settings) {
      void loadSettings().then(() => {
        // Update theme on the Shadow DOM root if it exists
        if (shadowUi?.uiContainer) {
          const wrapper = shadowUi.uiContainer.querySelector('.ll-root') as HTMLElement;
          if (wrapper && settings) {
            cleanupThemeWatcher?.();
            cleanupThemeWatcher = initTheme(wrapper, () => settings!.theme);
          }
        }
        renderUi();
      });
    }
  });
}
