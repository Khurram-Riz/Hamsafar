import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf7',
          100: '#d5f5ea',
          200: '#aeebd8',
          300: '#7adac0',
          400: '#43c1a3',
          500: '#1fa488',
          600: '#13846e',
          700: '#106a5a',
          800: '#105448',
          900: '#0f453c',
          950: '#062722',
        },
        amberwarm: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
    },
  },
  plugins: [],
};

export default config;
