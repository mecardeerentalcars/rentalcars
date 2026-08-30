import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    ".vinext/**",
    ".wrangler/**",
    ".mecardee-db-backup/**",
    ".mecardee-patch-backup/**",
    "dist/**",
    "out/**",
    "build/**",
    "examples/**",
    "Mecardee-BookingsTab-v8.9.12/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // This application intentionally synchronizes form defaults and live server
      // snapshots from effects; the React Compiler is not enabled for this build.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/exhaustive-deps": "off",
      // Vinext serves compressed, user-managed vehicle images and does not use
      // Next's image optimizer. Native images are the compatible runtime path.
      "@next/next/no-img-element": "off",
      // Forms use key handlers to prevent accidental Enter-key submission.
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
]);

export default eslintConfig;
