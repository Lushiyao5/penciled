import type { Annotation } from 'penciled/headless';
import { browser } from 'wxt/browser';
import { type PageData, pageKey } from './storage.ts';

/** Every annotated page's annotations, by page id. */
export async function allPages(): Promise<Map<string, Annotation[]>> {
  const all = await browser.storage.local.get(null);
  const pages = new Map<string, Annotation[]>();
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('page:')) pages.set(key.slice(5), (value as PageData).annotations);
  }
  return pages;
}

/** How many highlights use each color id, across every page. */
export async function colorUsage(): Promise<Map<string, number>> {
  const usage = new Map<string, number>();
  for (const annotations of (await allPages()).values()) {
    for (const a of annotations) usage.set(a.color, (usage.get(a.color) ?? 0) + 1);
  }
  return usage;
}

/**
 * Moves every highlight colored `from` to `to`. Tabs already open on those pages show the change
 * once reloaded.
 */
export async function recolor(from: string, to: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  const changed: Record<string, PageData> = {};
  for (const [id, annotations] of await allPages()) {
    if (!annotations.some((a) => a.color === from)) continue;
    changed[pageKey(id)] = {
      version: 1,
      annotations: annotations.map((a) => (a.color === from ? { ...a, color: to, updatedAt } : a)),
    };
  }
  await browser.storage.local.set(changed);
}
