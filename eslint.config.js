import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

const commonRules = {
  'no-unused-vars': [
    'error',
    {
      varsIgnorePattern: '^[A-Z_]',
      argsIgnorePattern: '^[A-Z_]',
      caughtErrors: 'none',
    },
  ],
};

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'frontend/node_modules/**',
    'frontend/dist/**',
    'backend/node_modules/**',
    'backend/uploads/**',
    'mobile/**',
  ]),
  {
    files: ['backend/src/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: commonRules,
  },
  {
    files: ['frontend/src/**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: commonRules,
  },
]);
