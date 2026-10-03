import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          1: 'rgb(var(--color-surface-1) / <alpha-value>)',
          2: 'rgb(var(--color-surface-2) / <alpha-value>)',
          3: 'rgb(var(--color-surface-3) / <alpha-value>)',
          4: 'rgb(var(--color-surface-4) / <alpha-value>)',
        },
        hairline: {
          DEFAULT: 'rgb(var(--color-hairline) / <alpha-value>)',
          strong: 'rgb(var(--color-hairline-strong) / <alpha-value>)',
          tertiary: 'rgb(var(--color-hairline-tertiary) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
          subtle: 'rgb(var(--color-ink-subtle) / <alpha-value>)',
          tertiary: 'rgb(var(--color-ink-tertiary) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          focus: 'rgb(var(--color-primary-focus) / <alpha-value>)',
        },
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        'brand-secure': 'rgb(var(--color-brand-secure) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        overlay: 'rgb(var(--color-overlay) / <alpha-value>)',
        accent: {
          green: 'rgb(var(--color-accent-green) / <alpha-value>)',
          'green-tint': 'rgb(var(--color-accent-green-tint) / <alpha-value>)',
          orange: 'rgb(var(--color-accent-orange) / <alpha-value>)',
          'orange-tint': 'rgb(var(--color-accent-orange-tint) / <alpha-value>)',
          red: 'rgb(var(--color-accent-red) / <alpha-value>)',
          'red-tint': 'rgb(var(--color-accent-red-tint) / <alpha-value>)',
          purple: 'rgb(var(--color-accent-purple) / <alpha-value>)',
          'purple-tint': 'rgb(var(--color-accent-purple-tint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-xl': [
          'calc(clamp(2rem, 5vw, 5rem) * var(--text-scale))',
          { lineHeight: '1.05', letterSpacing: '-0.0375em', fontWeight: '600' },
        ],
        'display-lg': [
          'calc(clamp(1.75rem, 3.5vw, 3.5rem) * var(--text-scale))',
          { lineHeight: '1.10', letterSpacing: '-0.0321em', fontWeight: '600' },
        ],
        'display-md': [
          'calc(clamp(1.5rem, 2.5vw, 2.5rem) * var(--text-scale))',
          { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '600' },
        ],
        headline: [
          'calc(clamp(1.25rem, 1.75vw, 1.75rem) * var(--text-scale))',
          { lineHeight: '1.20', letterSpacing: '-0.0214em', fontWeight: '600' },
        ],
        'card-title': [
          'calc(clamp(1rem, 1.4vw, 1.375rem) * var(--text-scale))',
          { lineHeight: '1.25', letterSpacing: '-0.0182em', fontWeight: '500' },
        ],
        subhead: [
          'calc(clamp(0.9rem, 1.25vw, 1.25rem) * var(--text-scale))',
          { lineHeight: '1.40', letterSpacing: '-0.01em', fontWeight: '400' },
        ],
        'body-lg': [
          'calc(clamp(0.875rem, 1.125vw, 1.125rem) * var(--text-scale))',
          { lineHeight: '1.50', letterSpacing: '-0.0056em', fontWeight: '400' },
        ],
        body: [
          'calc(16px * var(--text-scale))',
          { lineHeight: '1.50', letterSpacing: '-0.0031em', fontWeight: '400' },
        ],
        'body-sm': [
          'calc(14px * var(--text-scale))',
          { lineHeight: '1.50', letterSpacing: '0', fontWeight: '400' },
        ],
        caption: [
          'calc(12px * var(--text-scale))',
          { lineHeight: '1.40', letterSpacing: '0', fontWeight: '400' },
        ],
        button: [
          'calc(14px * var(--text-scale))',
          { lineHeight: '1.20', letterSpacing: '0', fontWeight: '500' },
        ],
        eyebrow: [
          'calc(13px * var(--text-scale))',
          { lineHeight: '1.30', letterSpacing: '0.0308em', fontWeight: '500' },
        ],
        mono: [
          'calc(13px * var(--text-scale))',
          { lineHeight: '1.50', letterSpacing: '0', fontWeight: '400' },
        ],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        xxl: '24px',
      },
      spacing: {
        section: '96px',
      },
      boxShadow: {
        'focus-ring': '0 0 0 2px rgb(var(--color-primary) / 0.5)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
