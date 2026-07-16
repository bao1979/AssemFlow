/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@assemflow/core": resolve(__dirname, "../../engine/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
