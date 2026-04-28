/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.vue',
    './src/**/*.{js,ts,vue}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: ['light', 'dark'],
    darkTheme: 'dark',
  },
}

