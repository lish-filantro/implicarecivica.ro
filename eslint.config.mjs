// ESLint flat config (ESLint 9) for implicarecivica.ro
//
// Rules that matter for the manager-544 refactor:
//   - max-lines 200 (blank lines and comments excluded) on all application code
//   - no new `any` inside src/manager-544
// The campanii module and the public content pages are outside the refactor
// scope and are linted only with the Next.js defaults.

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** Paths outside the manager-544 refactor scope (campanii + public content pages) */
const OUT_OF_SCOPE = [
  'app/page.tsx',
  'app/despre/**',
  'app/contact/**',
  'app/politica-cookies/**',
  'app/institutii/**',
  'lib/institutii.ts',
  'lib/institutii-search.ts',
  'app/campanii/**',
  'app/api/campanii/**',
  'components/campanii/**',
  'lib/campanii/**',
  'lib/hooks/useCampaignWizard.ts',
  'app/alegeri-locale-2024/**',
  'app/quiz/**',
  'components/quiz/**',
  'lib/quiz/**',
  'app/design-demo/**',
];

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.worktrees/**',
      'out/**',
      'coverage/**',
      'next-env.d.ts',
      'tests/**',
      'data/**',
      'public/**',
      'supabase/**',
      'tools/**',
      'cloudflare-email-worker/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Application code in scope (manager 544): hard cap on file length.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'middleware.ts'],
    ignores: OUT_OF_SCOPE,
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Out-of-scope public pages: report the cap, do not block
    files: OUT_OF_SCOPE,
    rules: {
      'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // New code (src/manager-544): hard cap + strict typing
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Out of scope (campanii, public content pages): report, never block
    files: OUT_OF_SCOPE,
    rules: {
      '@next/next/no-html-link-for-pages': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
  {
    // Legacy code: keep the Next defaults but do not block on pre-existing style issues
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'middleware.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-img-element': 'warn',
    },
  },
];

export default config;
