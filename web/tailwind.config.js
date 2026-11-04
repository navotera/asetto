/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--a-primary)',
        'primary-light': 'var(--a-primary-light)',
        'primary-active': 'var(--a-primary-active)',
        success: 'var(--a-success)',
        'success-light': 'var(--a-success-light)',
        danger: 'var(--a-danger)',
        'danger-light': 'var(--a-danger-light)',
        warning: 'var(--a-warning)',
        'warning-light': 'var(--a-warning-light)',
        info: 'var(--a-info)',
        'info-light': 'var(--a-info-light)',
        'text-default': 'var(--a-text)',
        'text-muted': 'var(--a-text-muted)',
        'text-strong': 'var(--a-text-strong)',
        'card-bg': 'var(--a-bg-card)',
        'page-bg': 'var(--a-bg-page)',
        'sidebar-bg': 'var(--a-sidebar-bg)',
        'topbar-bg': 'var(--a-bg-topbar)',
        'border-default': 'var(--a-border)',
        'border-soft': 'var(--a-border-soft)',
        'field-bg': 'var(--a-field-bg)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04), 0 1px 3px 0 rgba(16, 24, 40, 0.06)',
        pop: '0 10px 30px -12px rgba(16, 24, 40, 0.25)',
      },
    },
  },
  plugins: [],
};
