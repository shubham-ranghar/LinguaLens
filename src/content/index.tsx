import { createRoot, type Root } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { FloatingTrigger, SelectionPopup } from '@/components/SelectionPopup';
import { fetchSettings } from '@/lib/messaging';
import { getSelectedText, getSelectionRect, initTheme } from '@/lib/utils';
import type { UserSettings } from '@/types';
import '@/assets/tailwind.css';
import { logger } from '@/lib/logger';

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
  let debounceTimer: number | null = null;
  let mutationObserver: MutationObserver | null = null;
  let pollingInterval: number | null = null;
  let lastUrl = window.location.href;
  let shadowRoots: Set<ShadowRoot> = new Set();
  let isContextValid = true;

  // Log when content script loads
  logger.debug('LinguaLens content script loaded on:', window.location.href);

  // ============================================
  // CONTEXT INVALIDATION HANDLING
  // ============================================
  
  function handleContextInvalidation(): void {
    logger.warn('Extension context invalidated, cleaning up...');
    isContextValid = false;
    
    // Clean up all resources
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (pollingInterval) {
      window.clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (reactRoot) {
      reactRoot.unmount();
      reactRoot = null;
    }
    if (shadowUi) {
      shadowUi.remove();
      shadowUi = null;
    }
    if (cleanupThemeWatcher) {
      cleanupThemeWatcher();
      cleanupThemeWatcher = null;
    }
    
    // Clear shadow roots set
    shadowRoots.clear();
    
    // Hide any remaining UI
    uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
    
    logger.warn('Context invalidation cleanup complete');
  }

  // Listen for context invalidation
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onSuspend?.addListener?.(() => {
      logger.warn('Extension suspend detected');
      handleContextInvalidation();
    });
  }

  async function loadSettings(): Promise<UserSettings> {
    if (!isContextValid) {
      logger.warn('Cannot load settings: extension context invalid');
      throw new Error('Extension context invalidated');
    }
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
    if (!reactRoot || !settings) {
      logger.debug('renderUi: Cannot render - reactRoot or settings missing', { hasReactRoot: !!reactRoot, hasSettings: !!settings });
      return;
    }

    const { mode, text, position } = uiState;

    logger.debug('renderUi called with mode:', mode, 'text length:', text.length, 'position:', position);

    if (mode === 'hidden') {
      logger.debug('renderUi: Rendering null (hidden mode)');
      reactRoot.render(null);
      return;
    }

    if (mode === 'trigger') {
      logger.debug('renderUi: Rendering FloatingTrigger');
      reactRoot.render(
        <FloatingTrigger
          position={position}
          onClick={() => {
            logger.debug('FloatingTrigger clicked, switching to popup mode');
            ignoreSelectionChange = true;
            const rect = getSelectionRect();
            uiState = {
              ...uiState,
              mode: 'popup',
              position: rect ? getPopupPosition(rect) : uiState.position,
            };
            logger.debug('New UI state:', uiState);
            renderUi();
            window.setTimeout(() => {
              ignoreSelectionChange = false;
            }, 100);
          }}
        />,
      );
      return;
    }

    logger.debug('renderUi: Rendering SelectionPopup with text:', text.substring(0, 50));
    reactRoot.render(
      <SelectionPopup
        selectedText={text}
        position={position}
        settings={settings}
        onClose={() => {
          logger.debug('SelectionPopup onClose called');
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
        // Set maximum z-index to ensure visibility on all sites
        wrapper.style.zIndex = '2147483647';
        wrapper.style.position = 'fixed';
        // Don't set pointerEvents to none - it will block clicks
        // The individual components handle their own pointer events
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
      shadowHost.style.zIndex = '2147483647';
    }
  }

  // Debounced selection handler for performance
  function debouncedHandleSelectionChange(): void {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      void handleSelectionChange();
      debounceTimer = null;
    }, 150);
  }

  async function handleSelectionChange(): Promise<void> {
    if (ignoreSelectionChange) return;
    if (!isContextValid) {
      logger.warn('Selection change ignored: context invalid');
      return;
    }

    const text = getSelectedText();
    const rect = getSelectionRect();

    logger.debug('Selection changed:', { text, hasRect: !!rect, url: window.location.href });

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
    logger.debug('UI state updated:', uiState);
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

  // ============================================
  // EVENT LISTENERS - Multiple detection methods
  // ============================================

  // Use capture phase for better event interception
  document.addEventListener('mouseup', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    if (!ignoreSelectionChange) {
      debouncedHandleSelectionChange();
    }
  }, true);

  document.addEventListener('touchend', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    if (!ignoreSelectionChange) {
      debouncedHandleSelectionChange();
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    if (!ignoreSelectionChange) {
      debouncedHandleSelectionChange();
    }
  }, true);

  document.addEventListener('selectionchange', () => {
    if (ignoreSelectionChange) return;
    // Opening <select> and other popup controls clears page selection — don't close.
    if (uiState.mode === 'popup') return;

    const text = getSelectedText();
    if (!text && uiState.mode !== 'hidden') {
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  }, true);

  // Additional handling for SPAs like Instagram that might not trigger normal events
  document.addEventListener('mousedown', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    // Clear UI when clicking outside
    if (uiState.mode !== 'hidden') {
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  }, true);

  // Click event as fallback for touch devices
  document.addEventListener('click', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    if (!ignoreSelectionChange) {
      debouncedHandleSelectionChange();
    }
  }, true);

  // ============================================
  // MUTATION OBSERVER - SPA Navigation Detection
  // ============================================
  
  function setupMutationObserver(): void {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((mutations) => {
      // Check for URL changes (SPA navigation)
      if (window.location.href !== lastUrl) {
        logger.debug('URL changed from', lastUrl, 'to', window.location.href);
        lastUrl = window.location.href;
        // Reset UI state on navigation
        uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
        renderUi();
      }

      // Check for new Shadow Roots
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check if the node or its children contain shadow roots
            const allElements = node.querySelectorAll('*');
            allElements.forEach((el) => {
              if (el.shadowRoot && !shadowRoots.has(el.shadowRoot)) {
                shadowRoots.add(el.shadowRoot);
                logger.debug('New shadow root detected');
                // Add event listeners to shadow root
                el.shadowRoot.addEventListener('mouseup', () => {
                  if (!ignoreSelectionChange) {
                    debouncedHandleSelectionChange();
                  }
                });
                el.shadowRoot.addEventListener('touchend', () => {
                  if (!ignoreSelectionChange) {
                    debouncedHandleSelectionChange();
                  }
                });
                el.shadowRoot.addEventListener('selectionchange', () => {
                  if (!ignoreSelectionChange && uiState.mode !== 'popup') {
                    const text = getSelectedText();
                    if (!text && uiState.mode !== 'hidden') {
                      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
                      renderUi();
                    }
                  }
                });
              }
            });
          }
        });
      });
    });

    // Observe the entire document for changes
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    logger.debug('MutationObserver set up for SPA navigation detection');
  }

  // ============================================
  // POLLING FALLBACK - For sites that block events
  // ============================================
  
  function setupPolling(): void {
    if (pollingInterval) return;
    
    pollingInterval = window.setInterval(() => {
      const text = getSelectedText();
      const rect = getSelectionRect();
      
      // Only trigger if we have a selection but no UI showing
      if (text && rect && uiState.mode === 'hidden') {
        logger.debug('Polling detected selection:', text.substring(0, 30));
        void handleSelectionChange();
      }
    }, 500); // Check every 500ms
    
    logger.debug('Polling fallback set up');
  }

  // ============================================
  // IFRAME SUPPORT
  // ============================================
  
  function setupIframeSupport(): void {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        // Try to access iframe content (same-origin only)
        if (iframe.contentDocument) {
          iframe.contentDocument.addEventListener('mouseup', () => {
            if (!ignoreSelectionChange) {
              debouncedHandleSelectionChange();
            }
          }, true);
          iframe.contentDocument.addEventListener('touchend', () => {
            if (!ignoreSelectionChange) {
              debouncedHandleSelectionChange();
            }
          }, true);
          logger.debug('Added event listeners to iframe');
        }
      } catch (e) {
        // Cross-origin iframe - cannot access
        logger.debug('Cannot access cross-origin iframe');
      }
    });
  }

  // ============================================
  // HANDLE USER-SELECT: NONE CSS RESTRICTIONS
  // ============================================
  
  // This is a workaround for sites that set user-select: none
  // Uncomment if needed for specific sites that block text selection
  /*
  function forceTextSelection(): void {
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);
    logger.debug('Forced text selection via CSS');
  }
  */

  // ============================================
  // INITIALIZATION
  // ============================================
  
  // Load settings
  void loadSettings();

  // Set up SPA navigation detection
  setupMutationObserver();

  // Set up polling fallback for problematic sites
  setupPolling();

  // Set up iframe support
  setupIframeSupport();

  // Force text selection on sites that block it
  // Commented out by default as it may break site functionality
  // Uncomment if needed for specific sites
  // forceTextSelection();

  // Handle URL changes via history API (for SPAs)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      logger.debug('URL changed via pushState:', lastUrl);
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      logger.debug('URL changed via replaceState:', lastUrl);
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  };

  window.addEventListener('popstate', () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      logger.debug('URL changed via popstate:', lastUrl);
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  });

  // ============================================
  // MESSAGE HANDLERS
  // ============================================
  
  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === 'TRIGGER_TRANSLATE') {
      void openPopupForSelection();
    }
  });

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

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    if (pollingInterval) {
      window.clearInterval(pollingInterval);
    }
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
  });

  logger.debug('LinguaLens content script fully initialized with SPA support');
}
