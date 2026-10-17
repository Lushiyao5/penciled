# penciled

## 0.2.0

### Minor Changes

- f5b0645: The `data-penciled-*` styling hooks are now a stable, documented API. Restyle the toolbar, note editor and note preview with selectors like `[data-penciled-popover]`, `[data-penciled-swatch]` and `[data-penciled-action='note']`, and they won't break without a major version. See [Targeting the UI](https://penciled.org/guides/theming/#targeting-the-ui) for the full list.
  
  `[data-penciled-popover]` now has a value, so you can style the two cards separately: `[data-penciled-popover='toolbar']` or `[data-penciled-popover='preview']`. Existing `[data-penciled-popover]` selectors still match both.
  
  Cards placed at `bottom-start` or `bottom-end` now animate in from their top edge, like cards placed at `bottom`.

## 0.1.0

### Minor Changes

- 5f1f3b0: Initial release. `annotate()` adds text highlights and notes to any element, with a floating toolbar, a note editor, five color presets, light and dark themes and keyboard access. Highlights are painted with the CSS Custom Highlight API without modifying your DOM, re-anchored when the content changes, and saved to `localStorage` or your own storage adapter. Also includes `penciled/headless` (the engine without UI), `penciled/react` (`useAnnotations` and `<Annotatable>`), and conversion to and from the W3C Web Annotation format.
