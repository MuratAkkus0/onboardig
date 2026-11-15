import { defineConfig } from "vitest/config";
import { sharedConfig } from "./vitest.shared.ts";

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    include: ["tests/unit/**/*.test.ts"],
  },
});
