---
'penciled': patch
---

Fix transparent highlights and color swatches in apps whose bundler runs Lightning CSS for older browsers (Next.js 16, Vite with `css.transformer: 'lightningcss'`). Lightning CSS rewrites `light-dark()` into variables that were never set on the page root, so every default color resolved to nothing. Colors now default to light unless the page declares a `color-scheme`.

Fix the note editor losing its styles on pages with element resets such as Tailwind's preflight or normalize.css (no padding, a resize handle, a transparent Save button). Rules for penciled's own buttons, note field and shortcut hint now start with `[data-penciled-popover]` (specificity 0,1,0) instead of zero specificity. Any class selector still overrides them.
