/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16211f',
        moss: '#516b57',
        amberline: '#d99a2b',
        paper: '#f7f4ec',
        panel: '#ffffff',
        alert: '#b64232'
      },
      boxShadow: {
        soft: '0 12px 40px rgba(22, 33, 31, 0.08)'
      }
    },
  },
  plugins: [],
};
