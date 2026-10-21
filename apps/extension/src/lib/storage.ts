import type { Annotation, AnnotationStorage } from 'penciled/headless';
import { browser } from 'wxt/browser';

/** What the notes page lists for a page without loading its annotations. */
export interface PageMeta {
  /** The address the page was last annotated at, to open it from the notes page. */
  url: string;
  title: string;
  count: number;
  /** ISO 8601 timestamp. */
  updatedAt: string;
}

interface PageData {
  version: 1;
  annotations: Annotation[];
}

/** Each page's annotations, and its metadata, live under their own keys. */
export const pageKey = (id: string): string => `page:${id}`;
export const metaKey = (id: string): string => `meta:${id}`;

/**
 * Stores annotations in `chrome.storage.local`. Each change is applied to what's stored rather
 * than overwriting it, so the same page open in two tabs doesn't lose either tab's changes.
 */
export function extensionStorage(page: () => { url: string; title: string }): AnnotationStorage {
  // Changes are applied one at a time: each reads what the previous one wrote.
  let queue = Promise.resolve();

  const read = async (id: string) => {
    const key = pageKey(id);
    const data = (await browser.storage.local.get(key))[key] as PageData | undefined;
    return data?.annotations ?? [];
  };

  const write = async (id: string, annotations: Annotation[]) => {
    if (!annotations.length) return browser.storage.local.remove([pageKey(id), metaKey(id)]);
    const meta: PageMeta = {
      ...page(),
      count: annotations.length,
      updatedAt: new Date().toISOString(),
    };
    const data: PageData = { version: 1, annotations };
    await browser.storage.local.set({ [pageKey(id)]: data, [metaKey(id)]: meta });
  };

  const change = (id: string, edit: (annotations: Annotation[]) => Annotation[]) => {
    const next = queue.then(async () => write(id, edit(await read(id))));
    queue = next.catch(() => {});
    return next;
  };

  const put = (id: string, a: Annotation) =>
    change(id, (list) => [...list.filter((b) => b.id !== a.id), a]);

  return {
    load: read,
    save: (id, annotations) => change(id, () => annotations),
    create: put,
    update: put,
    delete: (id, annotationId) => change(id, (list) => list.filter((a) => a.id !== annotationId)),
  };
}
