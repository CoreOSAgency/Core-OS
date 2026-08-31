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
        // Beautiful Sunbird. Chrome = the iridescent green mantle in shadow;
        // accents = the shimmering plumage and the yellow→orange→red belly band.
        "core-icon": "#08150f",
        "core-nav": "#0b1c14",
        "core-main": "#0a1611",
        "core-card": "#10251b",
        // `core-purple` keeps its name to avoid renaming ~90 usages — it is
        // now the iridescent emerald green (head & back). Primary accent.
        "core-purple": "#13c56b",
        "core-green": "#0bda51", // malachite — success / active / connected
        "core-teal": "#12a5b8", // shoulder & rump patch — secondary accent, info
        "core-scarlet": "#e33127", // belly band red — errors / destructive
        "core-amber": "#f46904", // belly band orange — warnings / highlights
        "core-yellow": "#ffd23f", // belly band yellow — emphasis
      },
    },
  },
  plugins: [],
};
export default config;
