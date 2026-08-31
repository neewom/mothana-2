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
        // Couleurs sémantiques réservées à la signalisation d'état (jamais décoratives),
        // distinctes de l'encre de marque (stamp) — même principe que l'ancien DESIGN.md
        // (rouge/ambre/émeraude séparés de l'accent primaire), ajoutées en rollout quand
        // une page a un vrai besoin d'avertissement/succès (ActivitesPage n'en avait pas).
        warning: {
          DEFAULT: '#b45309',
          tint: '#fffbeb',
          border: '#fde68a',
        },
        success: {
          DEFAULT: '#3f6b4a',
          tint: '#f2f6f3',
          border: '#c9dbcd',
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
