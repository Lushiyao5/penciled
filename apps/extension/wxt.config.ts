import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // Imports are written out, as in the rest of the repo.
  imports: false,
  zip: { artifactTemplate: 'penciled-{{version}}-{{browser}}.zip' },
  // Older targets make the CSS minifier rewrite light-dark() into variables that resolve on the
  // toolbar's shadow host, which pins the toolbar to light when its theme follows the system.
  vite: () => ({ build: { target: 'chrome123', cssTarget: 'chrome123' } }),
  manifest: {
    name: 'penciled – Highlighter & Notes for any web page',
    short_name: 'penciled',
    description:
      'Highlight text and take notes on any website. Your highlights come back when you return. Nothing leaves your browser.',
    homepage_url: 'https://penciled.org/extension/',
    // light-dark(), which penciled's colors use.
    minimum_chrome_version: '123',
    // Notes stay in this browser; unlimitedStorage lifts the 10 MB cap without an install warning.
    permissions: ['storage', 'unlimitedStorage'],
    commands: {
      toggle: {
        suggested_key: { default: 'Alt+Shift+H' },
        description: 'Hide or show highlights on this tab',
      },
    },
  },
});
