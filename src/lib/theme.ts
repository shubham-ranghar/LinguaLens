import type { Theme } from '@/types';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Resolve the theme setting to an actual 'light' or 'dark' value.
 * For 'system' mode, reads the OS preference.
 */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (typeof window === 'undefined') return theme === 'dark' ? 'dark' : 'light';
  if (theme === 'system') {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply the resolved theme class to a root element.
 * Adds 'dark' class for dark mode, removes it for light mode.
 */
export function applyThemeToRoot(root: HTMLElement, theme: Theme): void {
  const resolved = resolveTheme(theme);
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Set up a listener for OS theme changes when in 'system' mode.
 * Returns a cleanup function to remove the listener.
 */
export function watchSystemTheme(
  getCurrentTheme: () => Theme,
  onThemeChange: () => void,
): () => void {
  const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);

  const handleChange = () => {
    if (getCurrentTheme() !== 'system') return;
    onThemeChange();
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }
  // Legacy fallback
  else if (mediaQuery.addListener) {
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }

  return () => {};
}

/**
 * Initialize theme on a root element.
 * Applies the initial theme and sets up OS theme watching if needed.
 * Returns a cleanup function.
 */
export function initTheme(
  root: HTMLElement,
  getCurrentTheme: () => Theme,
  onThemeChange?: (resolved: 'light' | 'dark') => void,
): () => void {
  const applyCurrentTheme = () => {
    const currentTheme = getCurrentTheme();
    const resolved = resolveTheme(currentTheme);
    applyThemeToRoot(root, currentTheme);
    onThemeChange?.(resolved);
  };

  applyCurrentTheme();
  return watchSystemTheme(getCurrentTheme, applyCurrentTheme);
}
