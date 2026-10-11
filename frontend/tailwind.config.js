/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Heebo', 'Arial', 'sans-serif'] },
      colors: {
        // Light bank-green palette
        brand: {
          50: '#EDF8F2',
          100: '#D6F0E2',
          200: '#ADE1C6',
          300: '#77CCA3',
          400: '#3DB37D',
          500: '#12A05C',
          600: '#0E8A4F',
          700: '#0C6F41',
          800: '#0B5835',
          900: '#08432A',
        },
        ink: { DEFAULT: '#16241D', soft: '#52635A', muted: '#7C8B83' },
        surface: '#F6FAF7',
        line: '#E3EAE5',
        danger: { 50: '#FDECEC', 500: '#D93F3F', 600: '#BF3030' },
        warn: { 50: '#FFF5E0', 500: '#D98A0B', 600: '#B7791F' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 36, 29, 0.04), 0 4px 16px rgba(22, 36, 29, 0.04)',
        pop: '0 12px 40px rgba(22, 36, 29, 0.16)',
      },
    },
  },
  plugins: [],
};
