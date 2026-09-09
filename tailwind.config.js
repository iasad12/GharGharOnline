/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sketch: ['"Caveat"', '"Comic Sans MS"', 'cursive', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Outfit"', 'sans-serif']
      },
      colors: {
        paper: {
          50: '#fdfbf7',
          100: '#f8f4ec',
          200: '#ede6d6',
          300: '#ded4be',
          800: '#3a332a',
          900: '#221f1a'
        },
        ink: {
          blue: '#1a365d',
          red: '#991b1b',
          pencil: '#374151'
        }
      },
      backgroundImage: {
        'notebook-grid': 'radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)',
        'notebook-grid-dark': 'radial-gradient(circle, #475569 1.2px, transparent 1.2px)',
      }
    },
  },
  plugins: [],
}
