/** @type {import('tailwindcss').Config} */
// TopTechHR brand (KICKOFF §4e). The token names `ink`, `paper` and `night` are kept so the components ported from
// Key Personnel read the brand values without being rewritten; the values are TopTechHR's own.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Montserrat', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        body: ['"Open Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // light: navy headings and nav, body grey, ground and surface
        ink: { DEFAULT: '#1F2A44', muted: '#4A5568' },
        paper: { DEFAULT: '#EEF3FA', 2: '#E3EEF8' },
        night: { DEFAULT: '#141A2B', 2: '#1B2238', ink: '#D7DEEA', muted: '#A9B4C8' },
        brand: {
          navy: '#1F2A44',
          accent: '#2A7FBF', // lines, underlines, focus — never under text (4.3:1 on white)
          fill: '#1F6FA8', // filled surfaces that carry text: primary buttons, the top band, step badges (5.4:1)
          deco: '#3B9EDB', // decorative chips, navy text on them
          link: '#1F6FA8',
          linkDark: '#7FB8E6',
          line: '#D9E4F0',
          chip: '#E3EEF8',
          amber: '#B45309',
          amberBg: '#FEF3C7',
        },
      },
      boxShadow: { card: '0 6px 24px rgba(31,42,68,0.06)' },
      maxWidth: { content: '1280px' },
    },
  },
  plugins: [],
};
