import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const themes = {
  dark: {
    props: {
      "color-scheme": "dark",
      "--focus": "#d64f4f",
      "--short": "#26baba",
      "--long": "#5fbbe6",
    },
    defaccent: "lavender",
  },
  light: {
    props: {
      "color-scheme": "light",
      "--focus": "#d64f4f",
      "--short": "#26baba",
      "--long": "#5fbbe6",
    },
    defaccent: "red",
  },
  black: {
    props: {
      "color-scheme": "dark",
      "--focus": "#d64f4f",
      "--short": "#26baba",
      "--long": "#5fbbe6",
    },
    defaccent: "lavender",
  },
  white: {
    props: {
      "color-scheme": "light",
      "--focus": "#d64f4f",
      "--short": "#26baba",
      "--long": "#5fbbe6",
    },
    defaccent: "red",
  },
}

const accents = {
  dark: {
    red: {
      "--bgcolor": "#252222",
      "--bgcolor2": "#403333",
      "--color": "#ffeeee",
      "--coloraccent": "#ffaaaa",
    },
    violet: {
      "--bgcolor": "#252225",
      "--bgcolor2": "#312131",
      "--color": "#ffeeff",
      "--coloraccent": "#ee82ee",
    },
    blue: {
      "--bgcolor": "#131320",
      "--bgcolor2": "#1d3752",
      "--color": "#eeeeff",
      "--coloraccent": "#9bb2ff",
    },
    lavender: {
      "--bgcolor": "#222230",
      "--bgcolor2": "#333340",
      "--color": "#eeeeff",
      "--coloraccent": "#b2b2ff",
    },
    green: {
      "--bgcolor": "#1d201d",
      "--bgcolor2": "#143814",
      "--color": "#eeffee",
      "--coloraccent": "#8dd48d",
    },
    teal: {
      "--bgcolor": "#111f1f",
      "--bgcolor2": "#303f3f",
      "--color": "#eeffff",
      "--coloraccent": "#00aaaa",
    },
    grey: {
      "--bgcolor": "#222222",
      "--bgcolor2": "#444444",
      "--color": "#dddddd",
      "--coloraccent": "#aaaaaa",
    },
  },
  light: {
    red: {
      "--bgcolor": "#fff3f3",
      "--bgcolor2": "#ffd2d2",
      "--color": "#222222",
      "--coloraccent": "#d64f4f",
    },
    violet: {
      "--bgcolor": "#fff3ff",
      "--bgcolor2": "#ffd2ff",
      "--color": "#222222",
      "--coloraccent": "#ee82ee",
    },
    blue: {
      "--bgcolor": "#f3f3ff",
      "--bgcolor2": "#d2d2ff",
      "--color": "#222222",
      "--coloraccent": "#4169e4",
    },
    lavender: {
      "--bgcolor": "#faf1ff",
      "--bgcolor2": "#e2d4ff",
      "--color": "#222222",
      "--coloraccent": "#8b51ff",
    },
    teal: {
      "--bgcolor": "#faffff",
      "--bgcolor2": "#cbebeb",
      "--color": "#222222",
      "--coloraccent": "#008080",
    },
    green: {
      "--bgcolor": "#f3fff3",
      "--bgcolor2": "#cafcc1",
      "--color": "#222222",
      "--coloraccent": "#39743d",
    },
    grey: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#dddddd",
      "--color": "#333333",
      "--coloraccent": "#555555",
    },
  },
  black: {
    red: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#403333",
      "--color": "#ffeeee",
      "--coloraccent": "#ffaaaa",
    },
    violet: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#312131",
      "--color": "#ffeeff",
      "--coloraccent": "#ee82ee",
    },
    blue: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#1d3752",
      "--color": "#eeeeff",
      "--coloraccent": "#9bb2ff",
    },
    lavender: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#333340",
      "--color": "#eeeeff",
      "--coloraccent": "#b2b2ff",
    },
    teal: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#303f3f",
      "--color": "#eeffff",
      "--coloraccent": "#00aaaa",
    },
    green: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#143814",
      "--color": "#eeffee",
      "--coloraccent": "#8dd48d",
    },
    grey: {
      "--bgcolor": "#000000",
      "--bgcolor2": "#444444",
      "--color": "#dddddd",
      "--coloraccent": "#aaaaaa",
    },
  },
  white: {
    red: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#ffd2d2",
      "--color": "#222222",
      "--coloraccent": "#ee7777",
    },
    violet: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#ffd2ff",
      "--color": "#222222",
      "--coloraccent": "#ee82ee",
    },
    blue: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#d2d2ff",
      "--color": "#222222",
      "--coloraccent": "#4169e4",
    },
    lavender: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#e2d4ff",
      "--color": "#222222",
      "--coloraccent": "#8b51ff",
    },
    teal: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#cbebeb",
      "--color": "#222222",
      "--coloraccent": "#008080",
    },
    green: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#cafcc1",
      "--color": "#222222",
      "--coloraccent": "#39743d",
    },
    grey: {
      "--bgcolor": "#ffffff",
      "--bgcolor2": "#dddddd",
      "--color": "#333333",
      "--coloraccent": "#555555",
    },
  },
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      accent: 'lavender',

      setTheme: (theme, accent) => {
        // Update state first
        const newAccent = accent || themes[theme].defaccent
        set({ theme, accent: newAccent })

        const root = document.documentElement

        // Set theme properties
        Object.entries(themes[theme].props).forEach(([prop, value]) => {
          root.style.setProperty(prop, value)
        })

        // Set accent properties
        Object.entries(accents[theme][newAccent]).forEach(([prop, value]) => {
          root.style.setProperty(prop, value)
        })

        // Update theme meta tag
        const themeMeta = document.getElementById('theme-meta')
        if (themeMeta) {
          themeMeta.setAttribute('content', accents[theme][newAccent]['--bgcolor'])
        }
      },

      getThemeColors: () => {
        const { theme } = get()
        return Object.keys(accents[theme])
      }
    }),
    {
      name: 'gomodoro-theme',
    }
  )
) 