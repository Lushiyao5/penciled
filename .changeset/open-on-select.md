---
'penciled': minor
---

Add an `openOnSelect` option. With `false`, selecting text doesn't open the toolbar until the reader presses the toolbar shortcut (`Alt+A` by default). Clicking an annotation still opens it.

Colors can now be `hidden`: annotations that already use a hidden color keep painting in it, but the toolbar only offers it on those annotations. This lets you retire a color without repainting existing highlights in the default color.
