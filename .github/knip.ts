import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["build/index.ts", ".github/empty-string-checker.ts"],
  project: ["src/**/*.ts"],
  ignore: ["src/types/config.ts", "**/__mocks__/**", "**/__fixtures__/**"],
  ignoreExportsUsedInFile: true,
  // eslint can also be safely ignored as per the docs: https://knip.dev/guides/handling-issues#eslint--jest
  ignoreDependencies: ["@mswjs/data", "@supabase/supabase-js", "@ubiquity-os/ubiquity-os-kernel", "ajv", "yaml", "simple-git", "@actions/core", "esbuild", "cypress"],
  eslint: true,
};

export default config;
