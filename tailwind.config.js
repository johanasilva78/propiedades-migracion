import { fontFamily } from 'tailwindcss/defaultTheme';

const tremorColors = {
  'tremor-border': {
    100: '#f0f4f8',
    200: '#e2e8f0',
    300: '#cbd5e1',
  },
  'tremor-ring': {
    100: '#c7d2fe',
    200: '#818cf8',
    300: '#4f46e5',
  },
  'tremor-background': {
    100: '#f9fafb',
    200: '#f3f4f6',
    300: '#e5e7eb',
  },
  'tremor-content': {
    100: '#1f2937',
    200: '#4b5563',
    300: '#9ca3af',
  },
};

const darkTremorColors = {
  'tremor-border': {
    100: '#1f2937',
    200: '#374151',
    300: '#4b5563',
  },
  'tremor-ring': {
    100: '#312e81',
    200: '#4338ca',
    300: '#6366f1',
  },
  'tremor-background': {
    100: '#111827',
    200: '#1f2937',
    300: '#374151',
  },
  'tremor-content': {
    100: '#f9fafb',
    200: '#d1d5db',
    300: '#9ca3af',
  },
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...tremorColors,
        ...darkTremorColors,
        brand: {
          DEFAULT: '#56955e',
          dark: '#2f6f3a',
        },
      },
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
      },
      boxShadow: {
        'tremor-card': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'tremor-dropdown': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
      },
      fontSize: {
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  plugins: [],
};
