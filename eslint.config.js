const typescriptParser = require("@typescript-eslint/parser");
const globals = require("globals");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2021,
      globals: globals.node,
      parser: typescriptParser,
      sourceType: "module",
    },
    rules: {},
  },
];
