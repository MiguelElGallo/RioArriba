import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/RioArriba/" : "/",
  server: {
    port: 5173
  },
  test: {
    environment: "node"
  }
}));
