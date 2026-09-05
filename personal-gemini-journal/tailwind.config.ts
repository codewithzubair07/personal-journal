import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#EFE7D8",
        parchmentDark: "#E4D9C4",
        ink: "#23282B",
        inkSoft: "#4A4F52",
        teal: "#2F6F62",
        tealDark: "#1F4B41",
        ochre: "#C08A3E",
        rule: "#D8CDB4",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
      },
      maxWidth: {
        prose: "42rem",
      },
    },
  },
  plugins: [],
};

export default config;
