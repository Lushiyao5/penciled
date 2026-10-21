# AGENTS.md

Instructions for AI coding agents working in this repo. Human contributors should read [CONTRIBUTING.md](./CONTRIBUTING.md), which covers the same ground in more detail.

## What this is

`penciled` is a framework-agnostic library for persistent text highlights and notes. `annotate('#article')` gives readers a floating toolbar and a note editor, and saves annotations to `localStorage` or a custom storage adapter. It's a text annotation library, not a website review tool. Screenshots, drawing, threaded discussions, accounts and sync backends are out of scope.

## Layout

- `packages/penciled/src/engine/`: the headless core. `anchoring/` maps selections to stored selectors and back, `render.ts` paints with the Highlight API, `storage.ts` handles persistence and `annotate.ts` ties them together. Exported as `penciled/headless`.
- `packages/penciled/src/ui/`: the default toolbar, note editor and hover preview, in plain DOM. Exported as `penciled`.
- `packages/penciled/src/react/`: the React adapter (`penciled/react`).
- `packages/penciled/src/styles.css`: the default styles (`penciled/styles.css`).
- `packages/penciled/test/`: browser tests. `packages/penciled/e2e/`: Playwright end-to-end tests.
- `apps/docs/`: the Astro + Starlight docs site and playground. Update it when you change behaviour or the API.

## Hard rules

- **Never modify the host DOM to render highlights.** Paint them with the CSS Custom Highlight API. Don't add a fallback that wraps text in elements.
- **Never highlight text you aren't confident about.** If anchoring is ambiguous, orphan the annotation: don't paint it, emit `orphan`, and keep it in the API.
- **`engine/` must never import from `ui/`, `react/`, React or Floating UI.** Biome enforces this.
- **Never write user-supplied text with `innerHTML`.** Use `textContent` or the `h()` helper in `ui/dom.ts`.
- **Importing must be SSR-safe:** no access to `window` or `document` at module top level. `test/ssr.node.test.ts` checks this.
- **Runtime dependencies:** `@floating-ui/dom` only. Ask before adding another.
- **Styles:** wrap every selector in `:where()` and theme through `--penciled-*` custom properties. The one exception: rules for penciled's own `button`, `textarea` and `kbd` elements are written `[data-penciled-popover] :where(…)` (0,1,0), so element resets like Tailwind's preflight don't strip them. Keep every rule for those elements at that specificity, or the `all: unset` base rule overrides it.
- **Size budget:** the default entry stays ≤ 16 kB, headless ≤ 6.5 kB and CSS ≤ 3 kB (min+gzip). Check with `pnpm build && pnpm size`.
- **The stored data shape is versioned.** Changing `Annotation` needs a `version` bump and a migration in `normalize()` (`engine/util.ts`).

## Anchoring model

Selectors (`quote`, `prefix`, `suffix`, `start`, `end`) are measured in the container's text with every whitespace run collapsed to one space. `script`, `style`, `template`, `noscript` and elements marked `data-penciled` are skipped. Offsets count UTF-16 code units. Restoring tries the stored position first, then exact matches scored by context, then a fuzzy search. A match that isn't clearly better than the runner-up counts as ambiguous.

Overlapping annotations are split into non-overlapping segments, and each segment is painted in the color of the innermost (shortest) annotation covering it. Clicks use the same innermost rule, so what's on top is what opens.

## Conventions

- TypeScript strict mode with `isolatedDeclarations`: exported functions need explicit return types.
- Relative imports use the `.ts` extension.
- Biome formatting: 2 spaces, single quotes, 100 columns. Run `pnpm format`.
- Comments explain *why*, not *what*. Public types and options get `/** */` doc comments, because they show up in users' editors.
- Tests are `*.test.ts` files that run in real browsers through Vitest browser mode. jsdom can't run them, because it has no Selection, Range rects or Highlight API. The one exception is `*.node.test.ts`, which runs in Node.
- Anchoring changes need a fixture in `test/anchoring.test.ts`. A fixture marks the annotated range and the expected match with `[[ … ]]`. Leave out the markers in `after` to expect an orphan.
- User-facing changes need a changeset (`pnpm changeset`), written for users of the library.

## Commands

`pnpm build` · `pnpm test` · `pnpm test:e2e` · `pnpm lint` · `pnpm typecheck` · `pnpm size` · `pnpm docs:dev`

Before finishing a change, run `pnpm lint`, `pnpm typecheck` and `pnpm test`. Also run `pnpm size` if you touched `src/`.
