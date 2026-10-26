/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // .env lives at the repository root, next to .env.example
  envDir: "..",
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  // Frontend unit tests (npm run test:frontend): components and hooks in a simulated browser.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"]
  }
});
