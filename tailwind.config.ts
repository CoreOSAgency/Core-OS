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
        // Sunbird plumage. Chrome = the iridescent metallic base seen in
        // shadow (deep green-black); accents = the vivid pectoral patches.
        "core-icon": "#08110b",
        "core-nav": "#0b160e",
        "core-main": "#091209",
        "core-card": "#122016",
        // `core-purple` keeps its name to avoid churn — it's now the
        // iridescent blue-violet (Marico Sunbird band). Primary accent.
        "core-purple": "#7c4dff",
        "core-green": "#0bda51", // malachite — success / active / connected
        "core-scarlet": "#e22b6e", // scarlet-chested — errors / destructive
        "core-amber": "#f46904", // lava orange — warnings / highlights
        "core-yellow": "#fffd37", // sunshine — rare emphasis
      },
    },
  },
  plugins: [],
};
export default config;
