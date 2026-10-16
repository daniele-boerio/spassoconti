import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Il pacchetto di handoff del redesign è materiale di riferimento (prototipi
  // HTML + runtime vendored), non codice dell'app.
  globalIgnores(['dist', 'design_handoff_spassoconto_redesign']),
  // JS / JSX — App.jsx, main.jsx, config, services/api.js (intentionally JS)
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Il service worker gira nel suo contesto: `self`, `caches`, `clients`.
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: globals.serviceworker,
      sourceType: 'script',
    },
  },
  // TS / TSX — the actual application code
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' },
      ],
      // The codebase intentionally uses `any` at the PrimeReact/MUI event
      // boundary; keep it visible as a warning rather than a hard failure.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // react-hooks v7 "react-compiler readiness" rules flag pre-existing patterns
  // across the app. Keep them visible as warnings (tech-debt to burn down)
  // instead of hard-failing the build.
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
])
