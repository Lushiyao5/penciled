# Contributing to penciled

Thanks for your interest! Bug reports, fixes and docs improvements are welcome. For new features or larger changes, please open an issue first so we can agree on the approach before you write code.

## Setup

Requirements: Node 22+ (see `.nvmrc`) and pnpm 10.

```sh
pnpm install
pnpm exec playwright install   # browsers for the test suite
```

## Common tasks

| Command | What it does |
|---|---|
| `pnpm dev` | Rebuild the library on change |
| `pnpm playground` | A bare test page for the library, with live reload |
| `pnpm docs:dev` | Run the docs site and its playground |
| `pnpm test` | Run the tests in real Chromium, Firefox and WebKit |
| `pnpm test:e2e` | Run the end-to-end flow with Playwright, on desktop and emulated mobile |
| `pnpm lint` / `pnpm format` | Check / fix lint and formatting with Biome |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm build && pnpm size` | Build, then check the bundle-size budget |

## How penciled is built

A few decisions shape the whole library. Changes that go against them need a discussion in an issue first.

- **The host DOM is never modified.** Highlights are painted with the CSS Custom Highlight API, not wrapper elements, so penciled works alongside React, Vue or any other framework that owns the DOM. There is no fallback for browsers without the API.
- **A wrong highlight is worse than a missing one.** Annotations store the quote, some surrounding context and its position. When the content changes and penciled can't find the quote with confidence, the annotation is *orphaned*: it isn't painted, but it stays available through the API.
- **The engine is headless.** `src/engine/` handles anchoring, painting, persistence and events, and never imports the UI, React or Floating UI. The default UI (`src/ui/`) and the React adapter (`src/react/`) are built on top of it.
- **Styles are easy to override.** The UI lives in the light DOM, every selector is wrapped in `:where()` (zero specificity), and theming goes through `--penciled-*` custom properties.
- **Small and dependency-light.** `@floating-ui/dom` is the only runtime dependency. `pnpm size` enforces the size budget.

## Tests

- Unit and integration tests live in `packages/penciled/test/` and run in real browsers through Vitest browser mode, because they need Selection, Range geometry and the Highlight API.
- Anchoring changes need fixtures in `test/anchoring.test.ts` covering the edge cases: edited text, moved paragraphs, repeated phrases and whitespace changes.
- The end-to-end flow lives in `packages/penciled/e2e/`.

## Before opening a pull request

- Add or update tests.
- Run `pnpm changeset` if the change affects users of `penciled`. Describe the change from the user's point of view.
- Update the docs in `apps/docs` if behaviour or the API changed.
- Make sure `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm size` all pass.

## Testing on real devices

Emulated mobile can't reproduce native text selection: long-press, selection handles and the operating system's selection menu. Before each release, run this checklist on a real iPhone (Safari) and a real Android phone (Chrome), against the docs site or `pnpm playground --host`.

**Selecting and highlighting**

- [ ] Long-press a word, then drag the selection handles across a sentence. The toolbar appears once the handles rest, below the selection, and doesn't cover the native menu.
- [ ] Extend the selection across two paragraphs. The toolbar follows the selection.
- [ ] Tap a color. The text is highlighted, the native selection disappears and the toolbar switches to the annotation's actions.
- [ ] The toolbar's buttons are comfortable to tap, with no mis-taps on a neighbor.
- [ ] Rotate the phone. The toolbar stays next to the text.

**Notes**

- [ ] Tap a highlight, then Add note. The keyboard opens, and the editor stays visible above it.
- [ ] Type a long note. The editor grows, and Save stays reachable.
- [ ] Save, reload the page, and tap the highlight. The note is shown.
- [ ] Edit the note, then remove the highlight. Both survive a reload.

**Scrolling and layout**

- [ ] Scroll while the toolbar is open. It follows the text, and is clamped to the screen near the edges.
- [ ] Pinch-zoom in, then select. The toolbar is placed correctly at the new scale.
- [ ] Tap outside the text. The toolbar closes.

**Accessibility**

- [ ] VoiceOver (iOS) and TalkBack (Android) announce the toolbar and its buttons by name, and can operate them.
- [ ] Dark mode: highlights and the toolbar are legible.

Record the devices and OS versions in the release pull request.

## Releasing

Releases are automated with [Changesets](https://github.com/changesets/changesets). Merging changesets into `main` opens a "Version packages" pull request. Merging that pull request publishes to npm with provenance.

## Code of Conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md). To report a security issue, see [SECURITY.md](./SECURITY.md).
