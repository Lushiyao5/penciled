# penciled

Beautiful, persistent text highlights and notes for any webpage. Think **Sonner, for text annotations**.

[Documentation](https://penciled-nu.vercel.app) · [Playground](https://penciled-nu.vercel.app/playground/) · [GitHub](https://github.com/marcellosso/penciled)

```sh
npm install penciled
```

```ts
import { annotate } from 'penciled';
import 'penciled/styles.css';

annotate('#article');
```

Readers can now select text to highlight it, add a note, or click a highlight to change it. Annotations are saved to `localStorage` and come back on reload.

## Features

- **Beautiful by default.** A floating toolbar and note editor that appear only when needed, in light and dark themes.
- **Framework-agnostic.** Plain DOM, with an optional React adapter. Highlights are painted with the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API), so your DOM is never modified.
- **Reliable anchoring.** Highlights are re-anchored when the content changes. When penciled can't be sure where a highlight belongs, it leaves it out instead of highlighting the wrong text.
- **Persistent.** Uses `localStorage` out of the box. Plug in your own storage adapter to save to a backend.
- **Accessible.** Keyboard shortcuts for the toolbar and for moving between annotations, with screen-reader announcements.
- **Small.** About 15 kB min+gzip with the UI, 6 kB headless. One dependency (`@floating-ui/dom`).

## Saving to your backend

```ts
annotate('#article', {
  documentId: 'post-42',
  storage: {
    load: (documentId) => fetch(`/api/annotations/${documentId}`).then((r) => r.json()),
    save: (documentId, annotations) =>
      fetch(`/api/annotations/${documentId}`, {
        method: 'PUT',
        body: JSON.stringify(annotations),
      }).then(() => {}),
  },
});
```

Adapters can also implement `create`, `update` and `delete` to save one annotation at a time. See [Custom storage](https://penciled-nu.vercel.app/recipes/rest-storage/).

## React

```tsx
import { Annotatable } from 'penciled/react';
import 'penciled/styles.css';

export function Article({ children }) {
  return <Annotatable options={{ documentId: 'post-42' }}>{children}</Annotatable>;
}
```

There is also a `useAnnotations(ref, options)` hook. See [React](https://penciled-nu.vercel.app/recipes/react/).

## Headless

`penciled/headless` is the engine without the UI. It handles anchoring, painting, persistence and events, and you build the interface.

```ts
import { annotate } from 'penciled/headless';

const annotator = annotate('#article');
annotator.on('select', (context) => {
  // Show your own UI for the selected text or annotation.
});
```

## Browser support

Chrome and Edge 105+, Safari 17.2+ and Firefox 140+, on desktop and mobile. With the default styles, the minimums are Chrome and Edge 123+ and Safari 17.5+. In older browsers `annotate()` logs a warning and does nothing. Importing is safe during server-side rendering. See [Browser support](https://penciled-nu.vercel.app/guides/browser-support/).

## License

[MIT](https://github.com/marcellosso/penciled/blob/main/LICENSE) © Marcel Losso
