# penciled

## 0.2.1

### Patch Changes

- 7e672d2: Fix transparent highlights and color swatches in apps whose bundler runs Lightning CSS for older browsers (Next.js 16, Vite with `css.transformer: 'lightningcss'`). Lightning CSS rewrites `light-dark()` into variables that were never set on the page root, so every default color resolved to nothing. Colors now default to light unless the page declares a `color-scheme`.
  
  Fix the note editor losing its styles on pages with element resets such as Tailwind's preflight or normalize.css (no padding, a resize handle, a transparent Save button). Rules for penciled's own buttons, note field and shortcut hint now start with `[data-penciled-popover]` (specificity 0,1,0) instead of zero specificity. Any class selector still overrides them.

## 0.2.0

### Minor Changes

- f5b0645: The `data-penciled-*` styling hooks are now a stable, documented API. Restyle the toolbar, note editor and note preview with selectors like `[data-penciled-popover]`, `[data-penciled-swatch]` and `[data-penciled-action='note']`, and they won't break without a major version. See [Targeting the UI](https://penciled.org/guides/theming/#targeting-the-ui) for the full list.
  
  `[data-penciled-popover]` now has a value, so you can style the two cards separately: `[data-penciled-popover='toolbar']` or `[data-penciled-popover='preview']`. Existing `[data-penciled-popover]` selectors still match both.
  
  Cards placed at `bottom-start` or `bottom-end` now animate in from their top edge, like cards placed at `bottom`.

## 0.1.0

### Minor Changes

- 5f1f3b0: Initial release. `annotate()` adds text highlights and notes to any element, with a floating toolbar, a note editor, five color presets, light and dark themes and keyboard access. Highlights are painted with the CSS Custom Highlight API without modifying your DOM, re-anchored when the content changes, and saved to `localStorage` or your own storage adapter. Also includes `penciled/headless` (the engine without UI), `penciled/react` (`useAnnotations` and `<Annotatable>`), and conversion to and from the W3C Web Annotation format.
