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
        "core-icon": "#0a0a0f",
        "core-nav": "#0f0f1a",
        "core-main": "#0d0d18",
        "core-card": "#141420",
        "core-purple": "#7c3aed",
      },
    },
  },
  plugins: [],
};
export default config;
