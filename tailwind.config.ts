import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // CoreOS brand: warm yellow->orange->red gradient + teal/cyan on a
        // charcoal base. From the logo palette.
        "core-icon": "#0c0d0f",
        "core-nav": "#141519",
        "core-main": "#111214",
        "core-card": "#1a1c21",
        // `core-purple` keeps its name to avoid renaming ~90 usages. It is
        // the brand orange - primary accent, dark text on fills.
        "core-purple": "#ff7a1a",
        "core-amber": "#ffb81c", // marigold - highlights, warnings, onboarding
        "core-gold": "#ffb81c", // alias of core-amber (kept for old usages)
        "core-scarlet": "#ff3d1a", // vermilion - errors / destructive / churned
        "core-teal": "#00bfae", // teal - success / active / connected / chat
        "core-green": "#00bfae", // alias of core-teal (kept for old usages)
        "core-cyan": "#00d4d8", // cyan - info / secondary
        "core-yellow": "#ffb81c", // alias of core-amber (kept for old usages)
      },
    },
  },
  plugins: [],
};
export default config;
