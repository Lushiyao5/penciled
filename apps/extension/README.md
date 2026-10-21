# penciled for the browser

A browser extension for highlighting text and taking notes on any web page, built on [penciled](../../packages/penciled). Highlights are saved in the browser (`chrome.storage.local`) and come back when you return to a page. Nothing is sent anywhere.

## Development

```sh
pnpm ext:dev     # builds penciled, then opens Chromium with the extension, reloading on changes
pnpm ext:build   # production build in apps/extension/.output/chrome-mv3
pnpm --filter extension test       # unit tests (Node, with WXT's fake browser APIs)
pnpm --filter extension test:e2e   # builds, then runs Playwright against the unpacked extension
```

To try a build by hand, open `chrome://extensions`, turn on developer mode and load `apps/extension/.output/chrome-mv3` with "Load unpacked".

## How it works

- `src/entrypoints/content.ts` runs on every page. It calls `annotate(document.body)` with the toolbar mounted in a shadow root outside `<body>`, so the page's CSS can't reach it. penciled's stylesheet is also added to the page itself, where the highlights are painted.
- `src/lib/url.ts` turns the page's address into the id annotations are stored under, without the fragment, tracking parameters, `www.` or a trailing slash. Single-page apps get a new id on every navigation.
- `src/lib/storage.ts` stores each page's annotations under `page:<id>` and a summary for the notes page under `meta:<id>`. Each change is applied to what's stored, so two tabs on the same page don't overwrite each other.
- `src/lib/scheme.ts` picks light or dark highlight colors from the page's actual background, since many dark sites don't declare a `color-scheme`.
