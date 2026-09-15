import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// `globals` has no Deno set. Deno exposes the web-standard APIs (fetch,
// Response, crypto, URL ...) plus the `Deno` namespace, and no DOM.
const denoGlobals = { ...globals["shared-node-browser"], Deno: "readonly" };

export default tseslint.config(
  // .design-sync is the design-system sync workspace, built by its own
  // tsconfig.sync.json and never part of the app.
  { ignores: ["dist", ".design-sync/**"] },
  {
    // Browser code: the Vite SPA (src/) and the Astro marketing pages (web/).
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}", "web/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Supabase Edge Functions and scripts/ (every script runs with `deno run`).
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["supabase/functions/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: denoGlobals,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Vercel serverless functions (api/) and the root build configs run on Node.
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["api/**/*.ts", "*.config.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
