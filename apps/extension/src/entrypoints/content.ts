import { type Annotator, annotate } from 'penciled';
// Added to every page through the manifest: highlights are painted there.
import 'penciled/styles.css';
import css from 'penciled/styles.css?inline';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { matchScheme } from '../lib/scheme.ts';
import { extensionStorage } from '../lib/storage.ts';
import { pageId } from '../lib/url.ts';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    // Not an HTML page (an image, XML), or a browser without the Highlight API.
    if (!document.body || typeof CSS === 'undefined' || !CSS.highlights) return;

    // The toolbar lives in a shadow root, out of reach of the page's CSS. It's open so tests can
    // reach it; closing it wouldn't hide notes from the page, which sees every keystroke anyway.
    const host = document.createElement('penciled-ui');
    const shadow = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
    // Outside <body>, so the page's own content and observers never see it.
    document.documentElement.append(host);

    let instance: Annotator | undefined;
    let current: string | undefined;

    // Single-page apps change the URL without a load: each address gets its own annotations.
    const start = (url: string) => {
      const id = pageId(url);
      if (id === current) return;
      current = id;
      // Saves what's pending for the previous address.
      instance?.destroy();
      matchScheme();
      const storage = extensionStorage(() => ({ url, title: document.title }));
      instance = annotate(document.body, { documentId: id, storage, root: shadow });
    };
    start(location.href);
    // Reported as navigation starts, before `location` changes.
    ctx.addEventListener(window, 'wxt:locationchange', (e) => start(e.newUrl.href));

    // Sites switch themes by changing a class or attribute on <html> or <body>.
    const theme = new MutationObserver(matchScheme);
    for (const el of [document.documentElement, document.body])
      theme.observe(el, { attributes: true });
    const os = matchMedia('(prefers-color-scheme: dark)');
    ctx.addEventListener(os, 'change', matchScheme);

    ctx.onInvalidated(() => {
      theme.disconnect();
      instance?.destroy();
      host.remove();
    });
  },
});
