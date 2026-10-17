---
'penciled': minor
---

Initial release. `annotate()` adds text highlights and notes to any element, with a floating toolbar, a note editor, five color presets, light and dark themes and keyboard access. Highlights are painted with the CSS Custom Highlight API without modifying your DOM, re-anchored when the content changes, and saved to `localStorage` or your own storage adapter. Also includes `penciled/headless` (the engine without UI), `penciled/react` (`useAnnotations` and `<Annotatable>`), and conversion to and from the W3C Web Annotation format.
