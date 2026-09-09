/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'studio-bg': '#0f0f14',
        'studio-panel': '#1a1a24',
        'studio-border': '#2a2a38',
        'studio-accent': '#8b5cf6',
        'studio-accent-hover': '#7c3aed',
        'studio-success': '#10b981',
        'studio-danger': '#ef4444',
        'studio-warning': '#f59e0b',
      }
    },
  },
  plugins: [],
}
