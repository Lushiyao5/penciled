---
'penciled': minor
---

The `data-penciled-*` styling hooks are now a stable, documented API. Restyle the toolbar, note editor and note preview with selectors like `[data-penciled-popover]`, `[data-penciled-swatch]` and `[data-penciled-action='note']`, and they won't break without a major version. See [Targeting the UI](https://penciled.org/guides/theming/#targeting-the-ui) for the full list.

`[data-penciled-popover]` now has a value, so you can style the two cards separately: `[data-penciled-popover='toolbar']` or `[data-penciled-popover='preview']`. Existing `[data-penciled-popover]` selectors still match both.

Cards placed at `bottom-start` or `bottom-end` now animate in from their top edge, like cards placed at `bottom`.
