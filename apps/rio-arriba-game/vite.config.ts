import { defineConfig } from "vite";

const isPreview = process.env.npm_lifecycle_event === "preview";

export default defineConfig(({ command }) => ({
  base: command === "build" || isPreview ? "/RioArriba/" : "/",
  server: {
    port: 5173
  },
  test: {
    environment: "node"
  }
}));
