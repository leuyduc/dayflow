import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // A portable review ZIP can be extracted under ignored .artifacts.
    // Never collect that cloned source as a second copy of every unit test.
    exclude: [...configDefaults.exclude, "**/.artifacts/**"],
  },
  resolve: {
    alias: {
      "@dayflow/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
    },
  },
});
