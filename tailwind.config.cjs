const tailwindcssAnimate = require('tailwindcss-animate')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Tokens du chantier de reconstruction visuelle (direction "carnet tamponné x
      // registre", pilote ActivitesPage) — namespacés pour ne pas entrer en collision
      // avec la palette Tailwind par défaut (slate/indigo/red/...) utilisée partout
      // ailleurs dans l'app tant que le reste des pages n'a pas été migré.
      colors: {
        paper: {
          DEFAULT: '#fdfcfa',
          border: '#e8e4dc',
          'border-muted': '#eee9e0',
        },
        ink: {
          DEFAULT: '#241f19',
          muted: '#5c5347',
          // #8a8175 initial ne tenait pas le contraste AA (3.8:1 sur blanc) — resserré à
          // 5.4:1 après la revue de finition, sans changer de famille de teinte.
          faint: '#726860',
        },
        stamp: {
          DEFAULT: '#a8281f',
        },
      },
      fontFamily: {
        registre: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'registre-mono': ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
