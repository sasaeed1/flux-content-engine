import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // ---- v2 semantic scale (raw hex via CSS vars) ----
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        edge: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          glow: 'var(--border-glow)',
        },
        ink2: 'var(--ink-2)',
        fg: { DEFAULT: 'var(--fg)', muted: 'var(--fg-muted)', dim: 'var(--fg-dim)' },
        flux: {
          violet: '#8B5CF6',
          'violet-deep': '#6D28D9',
          'violet-bright': '#A78BFA',
          cyan: '#22D3EE',
          'cyan-deep': '#0E9FBF',
          'cyan-bright': '#67E8F9',
          magenta: '#EC4899',
          'magenta-deep': '#BE2D7E',
          gold: '#F5B544',
          ink: '#06070B',
          glow: '#7C3AED',
          aurora: '#5D2E9B',
          signal: '#00D9FF',
          thinking: '#A78BFA',
        },
        state: {
          success: 'var(--success)',
          'success-bg': 'var(--success-bg)',
          warning: 'var(--warning)',
          'warning-bg': 'var(--warning-bg)',
          danger: 'var(--danger)',
          'danger-bg': 'var(--danger-bg)',
          info: 'var(--info)',
        },
      },
      backgroundImage: {
        'flux-gradient': 'linear-gradient(120deg, #A78BFA 0%, #22D3EE 52%, #EC4899 100%)',
        'flux-soft': 'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(34,211,238,0.18) 50%, rgba(236,72,153,0.18) 100%)',
        'aurora-core': 'radial-gradient(circle at 50% 0%, rgba(93,46,155,0.5), transparent 70%)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // semantic display scale
        hero: ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.0', letterSpacing: '-0.03em', fontWeight: '600' }],
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em', fontWeight: '700' }],
        'mono-stat': ['0.75rem', { lineHeight: '1', letterSpacing: '0.04em', fontWeight: '600' }],
      },
      borderRadius: {
        xs: '0.4rem',
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: '1.1rem',
        '2xl': '1.5rem',
        pill: '999px',
      },
      keyframes: {
        // ---- preserved ----
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // ---- v2 motion vocabulary ----
        'aurora-drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
          '33%': { transform: 'translate3d(36px,-26px,0) rotate(28deg) scale(1.05)' },
          '66%': { transform: 'translate3d(-28px,18px,0) rotate(-16deg) scale(0.97)' },
        },
        'pulse-think': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0.0), 0 0 18px -6px rgba(139,92,246,0.4)', opacity: '0.92' },
          '50%': { boxShadow: '0 0 0 1px rgba(139,92,246,0.45), 0 0 34px -4px rgba(139,92,246,0.6)', opacity: '1' },
        },
        'conic-spin': {
          to: { '--angle': '360deg' },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'slide-build': {
          '0%': { clipPath: 'inset(0 100% 0 0)', transform: 'scale(0.96)', opacity: '0.4' },
          '60%': { opacity: '1' },
          '100%': { clipPath: 'inset(0 0 0 0)', transform: 'scale(1)', opacity: '1' },
        },
        'engine-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.12)', opacity: '1' },
        },
        'engine-ripple': {
          '0%': { transform: 'scale(0.9)', opacity: '0.9' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'success-bloom': {
          '0%': { transform: 'scale(0.6)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'count-roll': {
          '0%': { transform: 'translateY(40%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'aurora-drift': 'aurora-drift 30s ease-in-out infinite',
        'pulse-think': 'pulse-think 1.8s ease-in-out infinite',
        'conic-spin': 'conic-spin 3s linear infinite',
        'shimmer-sweep': 'shimmer-sweep 1.6s ease-in-out infinite',
        'slide-build': 'slide-build 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'engine-pulse': 'engine-pulse 3s ease-in-out infinite',
        'engine-ripple': 'engine-ripple 0.9s ease-out infinite',
        'success-bloom': 'success-bloom 0.6s ease-out forwards',
        'count-roll': 'count-roll 0.7s cubic-bezier(0.16,1,0.3,1) both',
        breathe: 'breathe 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
