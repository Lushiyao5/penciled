---
'penciled': minor
---

Add a `root` option that mounts the toolbar, note preview and live region somewhere other than `document.body`. Pass a shadow root to keep the page's CSS away from penciled's UI, for example in a browser extension. Keyboard shortcuts, focus handling and clicks inside the UI work across the shadow boundary.
