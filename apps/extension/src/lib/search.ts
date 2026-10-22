import type { Annotation } from 'penciled/headless';
import type { Page } from './pages.ts';
import { cleanTag, tagsOf } from './tags.ts';

/** A search typed by the reader: `#tag` words must all be tags, and the rest is text to find. */
export interface Query {
  text: string;
  tags: string[];
}

export function parseQuery(query: string): Query {
  const tags: string[] = [];
  const words: string[] = [];
  for (const word of query.trim().split(/\s+/)) {
    if (word.startsWith('#') && cleanTag(word)) tags.push(cleanTag(word));
    else if (word) words.push(word);
  }
  return { text: words.join(' ').toLowerCase(), tags };
}

/** Writes `tags` and `text` back as a search, tags first. */
export function formatQuery({ text, tags }: Query): string {
  return [...tags.map((t) => `#${t}`), text].filter(Boolean).join(' ');
}

/** Whether something with `tags`, whose text is `fields`, matches `query`. */
export function matchesQuery(fields: string[], tags: string[], query: Query): boolean {
  if (!query.tags.every((t) => tags.includes(t))) return false;
  return !query.text || [...fields, ...tags].some((t) => t.toLowerCase().includes(query.text));
}

/** Whether annotation `a` on `page` matches `query`. */
export function matches(page: Page, a: Annotation, query: Query): boolean {
  return matchesQuery([a.quote, a.note ?? '', page.title, page.url], tagsOf(a), query);
}

/** The pages with annotations matching `query`, each with only those, in page order. */
export function search(pages: Page[], query: string): Page[] {
  const q = parseQuery(query);
  return pages
    .map((page) => ({
      ...page,
      annotations: page.annotations
        .filter((a) => matches(page, a, q))
        .sort((a, b) => a.start - b.start),
    }))
    .filter((page) => page.annotations.length);
}
