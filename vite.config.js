import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        howItWorks: "how-it-works.html",
        analyze: "analyze.html",
      },
    },
  },
});
