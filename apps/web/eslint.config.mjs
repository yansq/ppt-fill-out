import { plugin as shadcn } from "@shadcn/lint";
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { shadcn },
    settings: {
      shadcn: {
        ui: "@report-platform/ui",
        note: "Use shared UI variants and theme tokens instead of restyling components."
      }
    },
    rules: {
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-raw-colors": "error",
      "shadcn/no-restyle": ["error", { allow: ["layout"] }]
    }
  },
  {
    files: ["../../packages/ui/src/components/**/*.{ts,tsx}"],
    rules: {
      "shadcn/no-restyle": "off"
    }
  },
  globalIgnores([".next/**", "coverage/**", "next-env.d.ts"])
]);

