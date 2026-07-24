// eslint.config.js — flat config (#125)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "build/**", "node_modules/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Клиент (React, браузер)
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Vite JSX transform
      "react/prop-types": "off", // типы уже проверяются TypeScript'ом
      // "directory" — нестандартный (Firefox) атрибут <input> для выбора папки,
      // используется наравне с webkitdirectory; "cmdk-input-wrapper" — CSS-хук
      // библиотеки cmdk (shadcn/ui) для таргетинга через атрибут-селектор.
      "react/no-unknown-property": ["error", { ignore: ["directory", "cmdk-input-wrapper"] }],
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Сервер, общий код и конфиги в корне (Node)
  {
    files: ["server/**/*.ts", "shared/**/*.ts", "script/**/*.ts", "*.config.ts", "*.config.js", "eslint.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Конфиги плагинов (напр. tailwind.config.ts plugins: [require(...)]) —
  // стандартный паттерн для CJS-only пакетов без нормального ESM/типов.
  {
    files: ["*.config.ts", "*.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Тесты (Node + globals vitest уже импортируются явно в файлах)
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Общие правила для всего TS/TSX
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off", // проект активно использует any на границах парсинга — #127 адресует это точечно
      "no-console": "off",
    },
  },

  // Отключает стилистические ESLint-правила, конфликтующие с Prettier —
  // должно идти последним, чтобы переопределить всё выше.
  prettierConfig,
);
