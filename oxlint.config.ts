import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest'],
  categories: { correctness: 'error', suspicious: 'error' },
  rules: {
    'typescript/no-explicit-any': 'error',
    'typescript/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/no-unsafe-assignment': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/switch-exhaustiveness-check': 'error',
    'import/no-default-export': 'error',
    'import/no-cycle': 'error',
  },
  overrides: [{ files: ['*.config.ts'], rules: { 'import/no-default-export': 'off' } }],
});
