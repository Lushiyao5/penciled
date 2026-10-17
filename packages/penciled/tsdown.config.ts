import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    headless: 'src/headless.ts',
    react: 'src/react/index.ts',
  },
  format: 'esm',
  platform: 'browser',
  // Leave the check for the consumer's bundler: `platform: 'browser'` would inline "development".
  define: { 'process.env.NODE_ENV': 'process.env.NODE_ENV' },
  dts: true,
  copy: [{ from: 'src/styles.css', to: 'dist' }],
});
