import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        card: 'var(--color-card)',
        accent: 'var(--color-accent)',
        foreground: 'var(--color-text)',
        text: 'var(--color-text)',
        textSecondary: 'var(--color-text-secondary)',
        textDisabled: 'var(--color-text-disabled)',
        border: 'var(--color-border)',
        hover: 'var(--color-hover)',
        active: 'var(--color-active)',
        error: 'var(--color-error)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        // New dark mode specific colors
        darkBg: '#0A0A0A',
        darkBgAlt: '#0D0D0D',
        darkCard: '#151515',
        darkCardAlt: '#1A1A1A',
        darkBorder: '#2A2A2A',
        darkText: '#FFFFFF',
        darkTextAlt: '#F5F5F5',
        darkTextMuted: '#8A8A8A',
        darkTextMutedAlt: '#9CA3AF',
        darkSuccess: '#22C55E',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        sans: ['var(--font-app)'],
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
      },
    },
  },
} satisfies Config;
