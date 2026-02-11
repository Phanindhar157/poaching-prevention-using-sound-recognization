/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ios: {
          bg: {
            light: '#F2F2F7',
            dark: '#000000',
          },
          card: {
            light: 'rgba(255, 255, 255, 0.7)',
            dark: 'rgba(28, 28, 30, 0.7)',
          },
          text: {
            light: '#000000',
            dark: '#FFFFFF',
          },
          blue: '#0A84FF',
          red: '#FF453A',
          green: '#30D158',
          gray: '#8E8E93',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
