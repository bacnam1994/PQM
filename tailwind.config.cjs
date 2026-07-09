/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: {
          50: 'var(--surface-2)',
          100: 'var(--surface-3)',
          500: 'var(--green-500)',
          600: 'var(--green-600)',
          700: 'var(--green-700)',
          900: 'var(--green-900)',
          brand: 'var(--green-600)',
        },
        brand: {
          DEFAULT: 'var(--green-600)',
          light: 'var(--mint-500)',
        },
        ivory: 'var(--ivory)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
          faint: 'var(--ink-faint)',
        },
        border: 'var(--border)',
        zinc: {
          50: 'var(--surface-2)',
          100: 'var(--surface-2)',
          200: 'var(--border)',
          300: 'var(--border)',
          400: 'var(--ink-faint)',
          500: 'var(--ink-soft)',
          600: 'var(--ink-soft)',
          700: 'var(--ink)',
          800: 'var(--border)',
          900: 'var(--surface-3)',
          950: 'var(--surface)',
        },
        emerald: {
          50: 'rgba(16, 185, 129, 0.12)',
          100: 'rgba(16, 185, 129, 0.20)',
          400: 'var(--green-400)',
          500: 'var(--green-500)',
          600: 'var(--green-600)',
          700: 'var(--green-700)',
          900: 'var(--green-900)',
          950: 'var(--green-950)',
        },
        amber: {
          500: 'var(--amber-500)',
        },
        red: {
          500: 'var(--red-500)',
        }
      },
      boxShadow: {
        'soft': '0 1px 4px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'apple': '0 2px 16px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'in': 'animateIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-from-bottom-8': 'slideInFromBottom8 0.3s ease-out',
        'slide-in-from-bottom-4': 'slideInFromBottom4 0.3s ease-out',
        'slide-in-from-left-2': 'slideInFromLeft2 0.2s ease-out',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromBottom8: {
          '0%': { transform: 'translateY(2rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromBottom4: {
          '0%': { transform: 'translateY(1rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromLeft2: {
          '0%': { transform: 'translateX(-0.5rem)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(1rem)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    { pattern: /^(bg|text|border|ring)-(zinc)-(50|100|200|300|400|500|600|700|800|900|950)$/ },
    { pattern: /^(bg|text|border|ring)-(emerald)-(50|100|200|400|500|600|700|900|950)$/ },
  ]
}
