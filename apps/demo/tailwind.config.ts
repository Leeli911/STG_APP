import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./apps/demo/index.html",
    "./apps/demo/src/**/*.{js,ts,jsx,tsx}",
    "./apps/web/src/app/training-demo/page.tsx",
    "./apps/web/src/components/training/**/*.{js,ts,jsx,tsx}",
    "./apps/web/src/features/training-session/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f7f8fb",
        focus: "#2563eb",
        success: "#0f766e"
      }
    }
  },
  plugins: []
};

export default config;
