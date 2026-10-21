import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// Unit tests run in Node against WXT's in-memory fake of the extension APIs.
export default defineConfig({
  plugins: [WxtVitest()],
  test: { include: ['test/**/*.test.ts'] },
});
