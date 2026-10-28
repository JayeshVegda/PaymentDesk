import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@payment-ledger/shared': `${root}packages/shared/src/index.ts`,
      '@payment-ledger/parser': `${root}packages/parser/src/index.ts`,
      '@payment-ledger/core': `${root}packages/core/src/index.ts`,
      '@payment-ledger/database': `${root}packages/database/src/index.ts`
    }
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'scripts/**/*.test.ts'],
    testTimeout: 10_000
  }
});
