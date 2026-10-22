import { type Annotator, annotate } from 'penciled';
// Added to every page through the manifest: highlights are painted there.
import 'penciled/styles.css';
import css from 'penciled/styles.css?inline';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { PageState, Request } from '../lib/messages.ts';
import { takeOpened } from '../lib/pages.ts';
import { matchScheme } from '../lib/scheme.ts';
import { getSettings, onSettings, type Settings } from '../lib/settings.ts';
import { disabledSites, onDisabledSites, setSiteEnabled, siteOf } from '../lib/sites.ts';
import { extensionStorage, type PageData, pageKey } from '../lib/storage.ts';
import { pageId } from '../lib/url.ts';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main(ctx) {
    // Not an HTML page (an image, XML), or a browser without the Highlight API.
    if (!document.body || typeof CSS === 'undefined' || !CSS.highlights) return;

    let url = location.href;
    let settings: Settings;
    let disabled: string[];
    // Hidden on this tab with the keyboard shortcut, until it's pressed again or the page reloads.
    let hidden = false;
    let instance: Annotator | undefined;
    let current: string | undefined;
    let shadow: ShadowRoot | undefined;

    const site = () => siteOf(url);
    const off = () => hidden || disabled.includes(site());

    // The toolbar lives in a shadow root, out of reach of the page's CSS. It's open so tests can
    // reach it; closing it wouldn't hide notes from the page, which sees every keystroke anyway.
    // Created on first use, so pages where penciled is off get nothing at all.
    const ui = () => {
      if (shadow) return shadow;
      const host = document.createElement('penciled-ui');
      shadow = host.attachShadow({ mode: 'open' });
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [sheet];
      // Outside <body>, so the page's own content and observers never see it.
      document.documentElement.append(host);
      ctx.onInvalidated(() => host.remove());
      return shadow;
    };

    const stop = () => {
      // Saves what's pending, and removes the highlights.
      instance?.destroy();
      instance = undefined;
      current = undefined;
    };

    // Each address gets its own annotations, including the ones a single-page app moves between.
    const start = () => {
      if (off()) return stop();
      const id = pageId(url);
      if (instance && id === current) return;
      stop();
      current = id;
      matchScheme(settings.colors);
      const page = url;
      instance = annotate(document.body, {
        documentId: id,
        storage: extensionStorage(() => ({ url: page, title: document.title })),
        root: ui(),
        theme: settings.theme,
        openOnSelect: settings.openOnSelect,
        colors: settings.colors.map(({ id, label, hidden }) => ({
          name: id,
          label,
          ...(hidden && { hidden }),
        })),
      });
      const opened = instance;
      // Opened from the notes page: scroll to the highlight that was clicked there.
      opened.ready
        .then(() => takeOpened(id))
        .then((target) => target && instance === opened && opened.focus(target));
    };

    // Applies what the notes page, the settings page or another tab changed on this page's
    // highlights. This tab's own changes are already in place, so they change nothing.
    const sync = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
      const change = current && changes[pageKey(current)];
      if (!change || !instance) return;
      const before = (change.oldValue as PageData | undefined)?.annotations ?? [];
      const after = (change.newValue as PageData | undefined)?.annotations ?? [];
      const kept = new Set(after.map((a) => a.id));
      for (const a of before) if (!kept.has(a.id)) instance.remove(a.id);
      const had = new Set(before.map((a) => a.id));
      // Ones missing here that were already stored were removed in this tab and not saved yet.
      const newer = after.filter((a) => {
        const mine = instance!.get(a.id);
        return mine ? mine.updatedAt < a.updatedAt : !had.has(a.id);
      });
      if (newer.length) instance.import(newer);
    };

    const state = (): PageState => ({
      site: site(),
      disabled: disabled.includes(site()),
      hidden,
      colors: settings.colors,
      items: (instance?.getAll() ?? [])
        .map((a) => ({
          id: a.id,
          quote: a.quote,
          ...(a.note && { note: a.note }),
          color: a.color,
          orphan: !instance!.getRange(a.id),
        }))
        // In page order, then the ones that couldn't be found.
        .sort((a, b) => +a.orphan - +b.orphan),
    });

    const handle = async (message: Request) => {
      if (message.type === 'toggle') hidden = !hidden;
      else if (message.type === 'focus') instance?.focus(message.id);
      else if (message.type === 'remove') instance?.remove(message.id);
      else if (message.type === 'site') {
        // Applied here right away; other tabs on the site follow through storage.
        disabled = disabled.filter((s) => s !== site());
        if (!message.enabled) disabled.push(site());
        await setSiteEnabled(site(), message.enabled);
      }
      start();
      // Once stored annotations have loaded, so the popup never shows a partial list.
      await instance?.ready;
      return state();
    };
    browser.runtime.onMessage.addListener((message: Request, _sender, respond) => {
      handle(message).then(respond);
      return true;
    });

    [settings, disabled] = await Promise.all([getSettings(), disabledSites()]);
    if (!ctx.isValid) return;
    start();

    // Reported as navigation starts, before `location` changes.
    ctx.addEventListener(window, 'wxt:locationchange', (e) => {
      url = e.newUrl.href;
      start();
    });
    browser.storage.local.onChanged.addListener(sync);
    const unwatch = [
      () => browser.storage.local.onChanged.removeListener(sync),
      onSettings((next, previous) => {
        settings = next;
        // The theme applies live; anything else rebuilds the toolbar.
        const { theme: _, ...rest } = next;
        const { theme: __, ...was } = previous;
        if (JSON.stringify(rest) === JSON.stringify(was)) return instance?.setTheme(next.theme);
        stop();
        start();
      }),
      onDisabledSites((sites) => {
        disabled = sites;
        start();
      }),
    ];

    // Sites switch themes by changing a class or attribute on <html> or <body>.
    const theme = new MutationObserver(() => instance && matchScheme());
    for (const el of [document.documentElement, document.body]) {
      theme.observe(el, { attributes: true });
    }
    ctx.addEventListener(matchMedia('(prefers-color-scheme: dark)'), 'change', () => matchScheme());

    ctx.onInvalidated(() => {
      for (const fn of unwatch) fn();
      theme.disconnect();
      stop();
    });
  },
});
