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
  let cleanupThemeWatcher: (() => void) | null = null;
  let debounceTimer: number | null = null;
  let mutationObserver: MutationObserver | null = null;
  let pollingInterval: number | null = null;
  let lastUrl = window.location.href;
  let shadowRoots: Set<ShadowRoot> = new Set();
  let isContextValid = true;

  // Log when content script loads
  logger.debug('content-script', { action: 'loaded', url: window.location.href });

  // ============================================
  // CONTEXT INVALIDATION HANDLING
  // ============================================
  
  function handleContextInvalidation(): void {
    logger.warn('content-script', { action: 'context-invalidated' });
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
    logger.debug('content-script', { action: 'hide-ui-cleanup' });
    uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
    
    logger.warn('content-script', { action: 'context-invalidation-cleanup-complete' });
  }

  // Listen for context invalidation
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onSuspend?.addListener?.(() => {
      logger.warn('content-script', { action: 'extension-suspend-detected' });
      handleContextInvalidation();
    });
  }

  async function loadSettings(): Promise<UserSettings> {
    if (!isContextValid) {
      logger.warn('content-script', { action: 'settings-load-failed-context-invalid' });
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
    if (!container && !host) {
      logger.debug('content-script', { action: 'isEventInsideExtensionUi-false', reason: 'no-container-or-host' });
      return false;
    }

    const path = event.composedPath();
    const hostInPath = host && path.includes(host);
    const containerInPath = container && path.includes(container);
    
    logger.debug('content-script', { 
      action: 'isEventInsideExtensionUi-check', 
      hasHost: !!host,
      hasContainer: !!container,
      hostInPath,
      containerInPath,
      pathLength: path.length,
      eventType: event.type,
      uiStateMode: uiState.mode
    });
    
    if (hostInPath) return true;
    if (containerInPath) return true;
    return false;
  }

  function getTriggerPosition(rect: DOMRect): { top: number; left: number } {
    // Account for scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Account for zoom level
    const zoomLevel = window.devicePixelRatio || 1;
    const adjustedRect = {
      top: rect.top / zoomLevel,
      right: rect.right / zoomLevel,
      left: rect.left / zoomLevel,
      bottom: rect.bottom / zoomLevel,
    };
    
    return {
      top: Math.max(8, adjustedRect.top + scrollTop - 44),
      left: Math.min(adjustedRect.right + scrollLeft + 4, window.innerWidth - 44),
    };
  }

  function getPopupPosition(rect: DOMRect): { top: number; left: number } {
    const popupWidth = 360;
    const popupHeight = 320;
    
    // Account for scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Account for zoom level
    const zoomLevel = window.devicePixelRatio || 1;
    const adjustedRect = {
      top: rect.top / zoomLevel,
      right: rect.right / zoomLevel,
      left: rect.left / zoomLevel,
      bottom: rect.bottom / zoomLevel,
    };
    
    const spaceBelow = window.innerHeight - adjustedRect.bottom - 8;
    const spaceAbove = adjustedRect.top - 8;
    
    // If there's not enough space below but enough above, position above the selection
    let top;
    if (spaceBelow < popupHeight && spaceAbove > popupHeight) {
      top = Math.max(8, adjustedRect.top + scrollTop - popupHeight - 8);
    } else {
      top = Math.max(8, Math.min(adjustedRect.bottom + scrollTop + 8, window.innerHeight + scrollTop - popupHeight - 8));
    }
    
    // Ensure popup doesn't overflow horizontally
    let left = adjustedRect.left + scrollLeft;
    if (left + popupWidth > window.innerWidth + scrollLeft) {
      left = window.innerWidth + scrollLeft - popupWidth - 8;
    }
    if (left < scrollLeft + 8) {
      left = scrollLeft + 8;
    }
    
    return { top, left };
  }

  function renderUi(): void {
    if (!reactRoot || !settings) {
      logger.debug('content-script', { action: 'render-failed-missing-dependencies', hasReactRoot: !!reactRoot, hasSettings: !!settings });
      return;
    }

    const { mode, text, position } = uiState;

    logger.debug('content-script', { action: 'render-ui', mode, textLength: text.length, position });

    if (mode === 'hidden') {
      logger.debug('content-script', { 
        action: 'render-hidden', 
        stackTrace: new Error().stack,
        uiStateBefore: uiState
      });
      reactRoot.render(null);
      return;
    }

    if (mode === 'trigger') {
      logger.debug('content-script', { action: 'render-trigger' });
      reactRoot.render(
        <FloatingTrigger
          position={position}
          onClick={() => {
            logger.debug('content-script', { action: 'trigger-clicked' });
            const rect = getSelectionRect();
            uiState = {
              ...uiState,
              mode: 'popup',
              position: rect ? getPopupPosition(rect) : uiState.position,
            };
            logger.debug('content-script', { action: 'ui-state-updated', uiState });
            renderUi();
          }}
        />,
      );
      return;
    }

    logger.debug('content-script', { action: 'render-popup', textPreview: text.substring(0, 50) });
    reactRoot.render(
      <SelectionPopup
        selectedText={text}
        position={position}
        settings={settings}
        onClose={() => {
          logger.debug('content-script', { action: 'popup-close' });
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
    if (uiState.mode === 'popup') return; // Don't handle selection changes while popup is open
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      void handleSelectionChange();
      debounceTimer = null;
    }, 150);
  }

  async function handleSelectionChange(): Promise<void> {
    if (uiState.mode === 'popup') return; // Don't handle selection changes while popup is open
    if (!isContextValid) {
      logger.warn('content-script', { action: 'selection-ignored-context-invalid' });
      return;
    }

    const text = getSelectedText();
    const rect = getSelectionRect();

    logger.debug('content-script', { action: 'selection-changed', text, hasRect: !!rect, url: window.location.href });

    if (!text || !rect) {
      if (uiState.mode !== 'hidden') {
        logger.debug('content-script', { 
          action: 'handleSelectionChange-hiding-popup', 
          reason: 'no-text-or-rect',
          hasText: !!text,
          hasRect: !!rect,
          currentMode: uiState.mode,
          stackTrace: new Error().stack
        });
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
    logger.debug('content-script', { action: 'ui-state-updated', uiState });
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
    debouncedHandleSelectionChange();
  }, true);

  document.addEventListener('touchend', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    debouncedHandleSelectionChange();
  }, true);

  document.addEventListener('keyup', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    debouncedHandleSelectionChange();
  }, true);

  document.addEventListener('selectionchange', () => {
    logger.debug('content-script', { 
      action: 'selectionchange-event', 
      currentMode: uiState.mode,
      selectedText: getSelectedText()
    });
    // Don't close popup on selectionchange while it's open - this allows dropdowns to work
    if (uiState.mode === 'popup') return;

    const text = getSelectedText();
    if (!text && uiState.mode !== 'hidden') {
      logger.debug('content-script', { 
        action: 'selectionchange-hiding-popup', 
        stackTrace: new Error().stack
      });
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  }, true);

  // Single outside-click handler - only closes if click is genuinely outside the popup
  document.addEventListener('mousedown', (e) => {
    logger.debug('content-script', { 
      action: 'mousedown-event', 
      isInsideUi: isEventInsideExtensionUi(e),
      currentMode: uiState.mode,
      selectedText: getSelectedText()
    });
    if (isEventInsideExtensionUi(e)) return;
    // Only close if popup is visible and click is outside
    if (uiState.mode !== 'hidden') {
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  }, true);

  // Click event as fallback for touch devices
  document.addEventListener('click', (e) => {
    if (isEventInsideExtensionUi(e)) return;
    debouncedHandleSelectionChange();
  }, true);

  // ============================================
  // MUTATION OBSERVER - SPA Navigation Detection
  // ============================================
  
  function setupMutationObserver(): void {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver((mutations) => {
      // Check for URL changes (SPA navigation) via title changes
      // Most SPAs update the document title on navigation
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          // Check if the mutation is on the title element or its text content
          const isTitleMutation = 
            (target instanceof HTMLElement && target.tagName === 'TITLE') ||
            (target instanceof Text && target.parentElement?.tagName === 'TITLE');
          
          if (isTitleMutation) {
            if (window.location.href !== lastUrl) {
              logger.debug('content-script', { action: 'url-changed', from: lastUrl, to: window.location.href });
              lastUrl = window.location.href;
              // Reset UI state on navigation
              uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
              renderUi();
              // Re-scan for new shadow roots after navigation
              scanExistingShadowRoots();
              // Re-scan for new iframes after navigation
              setupIframeSupport();
            }
          }
        }
      });

      // Check for new Shadow Roots
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check if the node or its children contain shadow roots
            const allElements = node.querySelectorAll('*');
            allElements.forEach((el) => {
              if (el.shadowRoot && !shadowRoots.has(el.shadowRoot)) {
                attachShadowRootListeners(el.shadowRoot);
              }
            });
            // Also check the node itself
            if (node.shadowRoot && !shadowRoots.has(node.shadowRoot)) {
              attachShadowRootListeners(node.shadowRoot);
            }
          }
        });
      });

      // Check for dynamically added iframes
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLIFrameElement) {
            attachIframeListeners(node);
          } else if (node instanceof HTMLElement) {
            const iframes = node.querySelectorAll('iframe');
            iframes.forEach((iframe) => {
              if (!iframe.hasAttribute('data-ll-handled')) {
                attachIframeListeners(iframe);
              }
            });
          }
        });
      });
    });

    // Observe document head for title changes (most efficient for SPA detection)
    const titleElement = document.querySelector('title');
    if (titleElement) {
      mutationObserver.observe(titleElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    // Also observe head for title element additions/replacements
    const headElement = document.head;
    if (headElement) {
      mutationObserver.observe(headElement, {
        childList: true,
        subtree: false,
      });
    }

    // Observe body for shadow roots and iframes (but not all DOM changes)
    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      });
    }

    // Watch for document.body replacement (some SPAs replace entire body)
    const bodyObserver = new MutationObserver(() => {
      if (document.body && !document.body.hasAttribute('data-ll-observed')) {
        document.body.setAttribute('data-ll-observed', 'true');
        if (mutationObserver) {
          mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          });
        }
        // Re-scan after body replacement
        scanExistingShadowRoots();
        setupIframeSupport();
      }
    });
    bodyObserver.observe(document.documentElement, {
      childList: true,
      subtree: false,
    });

    logger.debug('content-script', { action: 'mutation-observer-setup' });
  }

  function attachShadowRootListeners(shadowRoot: ShadowRoot): void {
    if (shadowRoots.has(shadowRoot)) return;
    shadowRoots.add(shadowRoot);
    logger.debug('content-script', { action: 'shadow-root-detected' });
    
    shadowRoot.addEventListener('mouseup', () => {
      if (uiState.mode !== 'popup') {
        debouncedHandleSelectionChange();
      }
    });
    shadowRoot.addEventListener('touchend', () => {
      if (uiState.mode !== 'popup') {
        debouncedHandleSelectionChange();
      }
    });
    shadowRoot.addEventListener('selectionchange', () => {
      if (uiState.mode !== 'popup') {
        const text = getSelectedText();
        if (!text && uiState.mode !== 'hidden') {
          uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
          renderUi();
        }
      }
    });
  }

  function scanExistingShadowRoots(): void {
    // Optimize: Only check elements that commonly have shadow roots
    // instead of querying all elements with querySelectorAll('*')
    const shadowHostSelectors = [
      'custom-element',
      '[data-shadow]',
      'video', // Some video players use shadow DOM
      'audio', // Some audio players use shadow DOM
    ];
    
    let foundCount = 0;
    
    // Check common shadow host selectors first
    shadowHostSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.shadowRoot && !shadowRoots.has(el.shadowRoot)) {
          attachShadowRootListeners(el.shadowRoot);
          foundCount++;
        }
      });
    });
    
    // Fallback: only check elements with shadowRoot property (more efficient than querySelectorAll('*'))
    // This is a tree walker approach that's much more performant
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node instanceof HTMLElement && node.shadowRoot && !shadowRoots.has(node.shadowRoot)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node instanceof HTMLElement && node.shadowRoot) {
        attachShadowRootListeners(node.shadowRoot);
        foundCount++;
      }
    }
    
    logger.debug('content-script', { action: 'shadow-roots-scanned', count: shadowRoots.size, newlyFound: foundCount });
  }

  // ============================================
  // POLLING FALLBACK - For sites that block events
  // ============================================
  
  function setupPolling(): void {
    if (pollingInterval) return;
    
    let lastPollText = '';
    let activityDetected = false;
    
    pollingInterval = window.setInterval(() => {
      const text = getSelectedText();
      const rect = getSelectionRect();
      
      // Only trigger if we have a selection but no UI showing
      if (text && rect && uiState.mode === 'hidden') {
        // Only log if text changed to reduce noise
        if (text !== lastPollText) {
          logger.debug('content-script', { action: 'polling-detected-selection', textPreview: text.substring(0, 30) });
          lastPollText = text;
          activityDetected = true;
        }
        void handleSelectionChange();
      } else if (!text) {
        lastPollText = '';
        // Reduce polling frequency when no activity detected
        if (activityDetected) {
          activityDetected = false;
          // Could implement adaptive polling here if needed
        }
      }
    }, 500); // Check every 500ms
    
    logger.debug('content-script', { action: 'polling-setup' });
  }

  // ============================================
  // IFRAME SUPPORT
  // ============================================
  
  function attachIframeListeners(iframe: HTMLIFrameElement): void {
    if (iframe.hasAttribute('data-ll-handled')) return;
    iframe.setAttribute('data-ll-handled', 'true');
    
    try {
      // Try to access iframe content (same-origin only)
      if (iframe.contentDocument) {
        iframe.contentDocument.addEventListener('mouseup', () => {
          if (uiState.mode !== 'popup') {
            debouncedHandleSelectionChange();
          }
        }, true);
        iframe.contentDocument.addEventListener('touchend', () => {
          if (uiState.mode !== 'popup') {
            debouncedHandleSelectionChange();
          }
        }, true);
        logger.debug('content-script', { action: 'iframe-listeners-added' });
      }
    } catch (e) {
      // Cross-origin iframe - cannot access
      logger.debug('content-script', { action: 'iframe-cross-origin-blocked' });
    }
  }

  function setupIframeSupport(): void {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      attachIframeListeners(iframe);
    });
    logger.debug('content-script', { action: 'iframe-support-setup', count: iframes.length });
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

  // Scan for existing shadow roots on initialization
  scanExistingShadowRoots();

  // Set up SPA navigation detection
  setupMutationObserver();

  // Set up iframe support
  setupIframeSupport();

  // Set up polling fallback for problematic sites
  setupPolling();

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
      logger.debug('content-script', { action: 'url-changed-pushstate', url: lastUrl });
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      logger.debug('content-script', { action: 'url-changed-replacestate', url: lastUrl });
      uiState = { mode: 'hidden', text: '', position: { top: 0, left: 0 } };
      renderUi();
    }
  };

  window.addEventListener('popstate', () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      logger.debug('content-script', { action: 'url-changed-popstate', url: lastUrl });
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

  logger.debug('content-script', { action: 'fully-initialized' });
}
