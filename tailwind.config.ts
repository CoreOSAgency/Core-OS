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
        // Southern Double-collared Sunbird. Chrome = the iridescent green
        // mantle seen in shadow; accents = the crimson breast patch, the
        // teal collar, and the pale pectoral-tuft gold.
        "core-icon": "#08150f",
        "core-nav": "#0b1c14",
        "core-main": "#0a1611",
        "core-card": "#10251b",
        // `core-purple` keeps its name to avoid renaming ~90 usages. It is
        // now the iridescent emerald green (head & back). Primary accent.
        "core-purple": "#13c56b",
        "core-green": "#0bda51", // malachite: success / active / connected
        "core-teal": "#0fb0a8", // collar patch: secondary accent, info, chat
        "core-scarlet": "#d51a1a", // crimson breast patch: errors / destructive
        "core-amber": "#f46904", // orange: warnings / onboarding
        "core-gold": "#e2d78a", // pale pectoral-tuft gold: highlights
        "core-yellow": "#e2d78a", // alias of core-gold, kept for old usages
      },
    },
  },
  plugins: [],
};
export default config;
