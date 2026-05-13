/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:  '#1818db',
          teal:  '#1ddbb1',
          bg:    '#f7f7f7',
          gray:  '#999999',
          dark:  '#494949',
          black: '#161616',
        },
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['12px', '16px'],
        sm:    ['13px', '18px'],
        base:  ['14px', '20px'],
        md:    ['15px', '22px'],
        lg:    ['16px', '24px'],
        xl:    ['18px', '26px'],
        '2xl': ['20px', '28px'],
        '3xl': ['24px', '32px'],
      },
      fontWeight: {
        normal:    '400',
        medium:    '500',
        semibold:  '600',
        bold:      '700',
        extrabold: '800',
      },
      letterSpacing: {
        tight:   '-0.02em',
        tighter: '-0.03em',
      },
      boxShadow: {
        card:       '0 1px 2px rgba(22,22,22,0.05), 0 2px 12px rgba(22,22,22,0.04)',
        'card-hover':'0 4px 16px rgba(24,24,219,0.10), 0 8px 32px rgba(22,22,22,0.06)',
        blue:       '0 4px 20px rgba(24,24,219,0.22)',
      },
    },
  },
  plugins: [],
};
