import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 手帳らしい落ち着いた配色（ネイビー×クリーム×アクセント）
        paper: "#faf7f0",
        ink: "#1f2937",
        rule: "#e7e0d3",
        navy: "#243b53",
        accent: "#b91c1c",
      },
      fontFamily: {
        hand: ['"Yu Gothic"', '"Hiragino Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
