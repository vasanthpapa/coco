/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        title: ['Righteous', 'cursive'],
      },
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        primary: '#3b82f6',
        secondary: '#64748b',
        textMain: '#f8fafc',
        textMuted: '#94a3b8'
      }
    },
  },
  plugins: [],
}
