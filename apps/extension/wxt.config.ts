import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // Imports are written out, as in the rest of the repo.
  imports: false,
  manifest: {
    name: 'penciled – Highlighter & Notes for any web page',
    short_name: 'penciled',
    description:
      'Highlight text and take notes on any website. Your highlights come back when you return. Nothing leaves your browser.',
    homepage_url: 'https://penciled.org/extension/',
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
