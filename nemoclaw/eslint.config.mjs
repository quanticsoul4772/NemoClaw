import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["strict-type-checked"]?.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      // Complexity thresholds - keep functions maintainable
      "complexity": ["error", { max: 15 }],
      "max-depth": ["error", { max: 4 }],
      "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
      "max-nested-callbacks": ["error", { max: 3 }],
      "max-params": ["error", { max: 5 }],
      // Naming convention enforcement
      "@typescript-eslint/naming-convention": [
        "error",
        // Default: camelCase for variables and functions
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // PascalCase for types, interfaces, classes, and enums
        {
          selector: ["typeLike", "enumMember"],
          format: ["PascalCase"],
        },
        // camelCase or PascalCase for object properties (flexible for external APIs)
        {
          selector: "objectLiteralProperty",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        // Allow UPPER_CASE for all const variables (constants)
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        // Allow PascalCase for imported names (library names like JSON5)
        {
          selector: "import",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
        // Functions and methods: camelCase
        {
          selector: ["function", "method"],
          format: ["camelCase"],
        },
        // Type parameters: single uppercase letter or PascalCase
        {
          selector: "typeParameter",
          format: ["PascalCase"],
        },
        // Allow unused parameters starting with underscore
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
      ],
    },
  },
  prettier,
];
