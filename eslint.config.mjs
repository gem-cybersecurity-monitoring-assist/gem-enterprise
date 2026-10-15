import nextPlugin from "eslint-config-next";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import tsPlugin from "eslint-config-next/typescript";

// eslint-config-next 16.x ships native flat-config arrays.
// Spread the shared config then layer project-specific rule overrides.
const eslintConfig = [
  { ignores: ["src/integrations/**"] },
  ...nextPlugin,
  ...coreWebVitals,
  ...tsPlugin,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      // New rules introduced in react-hooks plugin upgrade — pre-existing patterns
      // to be addressed in a dedicated refactoring pass, not this PR.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
];

export default eslintConfig;
