/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B2D',
        slateBlue: '#1C3D5A',
        compliant: '#1E7A4C',
        violation: '#E08A1E',
        critical: '#B23A2E',
        paper: '#F7F5F0',
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        serif: ['"Fraunces"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
