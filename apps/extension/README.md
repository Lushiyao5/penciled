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
- `src/lib/scheme.ts` sets each color's highlight value for the page's actual background, since many dark sites don't declare a `color-scheme`.
- `src/entrypoints/popup/` lists the current page's highlights, including ones that can no longer be found, and turns penciled off for the site. It talks to the page's content script with the messages in `src/lib/messages.ts`.
- `src/entrypoints/options/` is the extension's page, with two tabs. **Notes** (`notes.ts`) lists every highlight by site and page, searches them, opens or deletes them, and exports or imports them. **Settings** (`settings.ts`) has the toolbar theme, whether selecting text opens the toolbar, the color palette, the sites penciled is off on, and shortcuts. Settings live in `chrome.storage.sync` (`src/lib/settings.ts`). Open tabs apply changes right away.
- Colors have stable ids (`c1`, `c2`, …), which is what highlights store. A removed color that's still in use is kept but hidden from the toolbar, so no settings change can make a highlight disappear.
- `src/lib/backup.ts` exports everything as JSON (annotations in penciled's own format, plus the palette) or Markdown. Importing runs each annotation through penciled's `normalize()` and keeps whichever copy of a highlight changed last. Colors the palette doesn't have are added as removed colors, so imported highlights keep their color.
- Opening a highlight from the notes page opens a new tab and leaves a short-lived `open` entry in storage; the content script for that page scrolls to the highlight and clears it.
- Each content script watches its page's storage key, so deleting, recoloring or importing highlights elsewhere applies to open tabs straight away.
- `src/entrypoints/background.ts` passes the "hide or show highlights on this tab" shortcut to the tab.

The end-to-end tests open the popup in a tab, naming the page's tab with `popup.html?tab=<id>`.
