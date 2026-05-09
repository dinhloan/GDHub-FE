/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#e7fbf7',
        moss: '#35e6d0',
        amberline: '#ffb457',
        paper: '#06161d',
        panel: '#0b222b',
        alert: '#ff6b7a'
      },
      boxShadow: {
        soft: '0 18px 55px rgba(0, 0, 0, 0.34)'
      }
    },
  },
  plugins: [],
};
