// Runs from the repo root so both apps are covered — a backend file that
// skipped formatting used to pass the hook and then fail CI.
export default {
  'apps/frontend/src/**/*.{ts,tsx,css}': [
    'pnpm --filter frontend exec prettier --write',
  ],
  'apps/frontend/src/**/*.{ts,tsx,js,cjs,mjs}': [
    'pnpm --filter frontend exec eslint --fix --no-warn-ignored',
  ],
  'apps/backend/src/**/*.ts': [
    'pnpm --filter backend exec prettier --write',
    'pnpm --filter backend exec eslint --fix',
  ],
  '*.{json,md,yaml,yml}': ['pnpm --filter frontend exec prettier --write'],
};
