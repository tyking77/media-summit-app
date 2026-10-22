import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" lets the build work at any GitHub Pages repo path, since routing uses the URL hash.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
