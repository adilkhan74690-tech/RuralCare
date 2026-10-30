/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F8F7F3',          // Off-white background
        canvas: '#F8F7F3',         // Off-white page background
        surface: '#FFFFFF',        // White surfaces & cards
        yellow: {
          DEFAULT: '#FFC900',      // Primary yellow
          hover: '#EDB800',
          light: '#FFF5CC',
        },
        primary: {
          DEFAULT: '#FFC900',      // Primary yellow
          hover: '#EDB800',
          light: '#FFF5CC',
        },
        teal: {
          DEFAULT: '#008F83',      // Teal
          hover: '#007D72',
          light: '#E6F5F3',
          dark: '#006F67',
        },
        forest: {
          DEFAULT: '#008F83',      // Teal
          hover: '#007D72',
          light: '#00A395',
          dark: '#006F67',
        },
        deepTeal: {
          DEFAULT: '#006F67',      // Deep teal
          hover: '#005C55',
        },
        secondary: {
          DEFAULT: '#006F67',      // Deep teal
          hover: '#005C55',
          light: '#008F83',
        },
        mint: {
          DEFAULT: '#008F83',      // Teal accent for success states
          hover: '#007D72',
          light: '#E6F5F3',
          soft: '#CEEFEA',
        },
        black: '#111111',          // Black
        ink: {
          DEFAULT: '#111111',      // Black text
          muted: '#4A4A4A',        // Secondary text
          light: '#6E6E6E',
        },
        borderDark: '#111111',     // 2px solid black border
        borderBlack: '#111111',
        danger: {
          DEFAULT: '#FF6B6B',      // Alert red
          hover: '#FA5252',
          light: '#FFE3E3',
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'Inter', '-apple-system', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'brutal-xs': '1.5px 1.5px 0px #111111',
        'brutal-sm': '2.5px 2.5px 0px #111111',
        'brutal': '3.5px 3.5px 0px #111111',
        'brutal-md': '5px 5px 0px #111111',
        'brutal-lg': '6.5px 6.5px 0px #111111',
        'brutal-xl': '8px 8px 0px #111111',
      },
      borderWidth: {
        '2': '2px',
        '3': '3px',
      },
    },
  },
  plugins: [],
};
