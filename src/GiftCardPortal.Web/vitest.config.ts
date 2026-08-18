import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Without an origin, jsdom treats the document as opaque and refuses
    // `localStorage`, which is where interface preferences live.
    environmentOptions: { jsdom: { url: "http://localhost:5173/" } },
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    fileParallelism: false,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
