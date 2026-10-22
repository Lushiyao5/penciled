import type { Annotation } from 'penciled/headless';

/** Longer tags are cut to this many characters. */
export const MAX_TAG = 32;

/**
 * A tag as it's stored: lowercase, without a leading `#`, with spaces turned into hyphens, so
 * `#Reading list` and `reading-list` are the same tag. Empty if nothing's left.
 */
export function cleanTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[\s,]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG);
}

/** Annotation `a`'s tags, kept in its `meta` so penciled's data shape doesn't change. */
export function tagsOf(a: Pick<Annotation, 'meta'>): string[] {
  const tags = a.meta?.tags;
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
}

/** `meta` with `tags` in it, or without the key when there are none. */
export function withTags(
  meta: Record<string, unknown> | undefined,
  tags: string[],
): Record<string, unknown> {
  const { tags: _, ...rest } = meta ?? {};
  return tags.length ? { ...rest, tags } : rest;
}

/** Every tag in `lists`, each one highlight's tags, most used first. */
export function countTags(lists: string[][]): string[] {
  const counts = new Map<string, number>();
  for (const tags of lists) for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
