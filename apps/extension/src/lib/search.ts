import type { Annotation } from 'penciled/headless';
import type { Page } from './pages.ts';

/** Whether annotation `a` on `page` matches `query`, a search typed by the reader. */
export function matches(page: Page, a: Annotation, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    !q || [a.quote, a.note ?? '', page.title, page.url].some((t) => t.toLowerCase().includes(q))
  );
}

/** The pages with annotations matching `query`, each with only those, in page order. */
export function search(pages: Page[], query: string): Page[] {
  return pages
    .map((page) => ({
      ...page,
      annotations: page.annotations
        .filter((a) => matches(page, a, query))
        .sort((a, b) => a.start - b.start),
    }))
    .filter((page) => page.annotations.length);
}
