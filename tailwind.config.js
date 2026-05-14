/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: '#0A1929',
        'sidebar-hover': '#132F4C',
        'sidebar-active': '#173A5E',
        primary: '#0052CC',
        'primary-hover': '#0747A6',
      },
    },
  },
  plugins: [],
};
