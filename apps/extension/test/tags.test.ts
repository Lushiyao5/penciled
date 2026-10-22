import type { Annotation } from 'penciled/headless';
import { beforeEach, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { listPages, setTags } from '../src/lib/pages.ts';
import { formatQuery, parseQuery, search } from '../src/lib/search.ts';
import { extensionStorage } from '../src/lib/storage.ts';
import { cleanTag, countTags, tagsOf, withTags } from '../src/lib/tags.ts';

const URL = 'https://example.com/post';

const annotation = (id: string, extra: Partial<Annotation> = {}): Annotation => ({
  version: 1,
  id,
  quote: `quote ${id}`,
  prefix: '',
  suffix: '',
  start: 0,
  end: 7,
  color: 'c1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

beforeEach(() => fakeBrowser.reset());

test('tags are stored lowercase, without #, with hyphens for spaces', () => {
  expect(cleanTag('  #Reading List ')).toBe('reading-list');
  expect(cleanTag('##fox,')).toBe('fox');
  expect(cleanTag('Café')).toBe('café');
  expect(cleanTag('# - ')).toBe('');
  expect(cleanTag('x'.repeat(50))).toHaveLength(32);
});

test('tags live in meta, next to whatever else is there', () => {
  expect(withTags({ source: 'web' }, ['a'])).toEqual({ source: 'web', tags: ['a'] });
  expect(withTags({ source: 'web', tags: ['a'] }, [])).toEqual({ source: 'web' });
  expect(tagsOf({ meta: { tags: ['a', 3, 'b'] } })).toEqual(['a', 'b']);
  expect(tagsOf({ meta: { tags: 'a' } })).toEqual([]);
  expect(tagsOf({})).toEqual([]);
  expect(countTags([['b', 'a'], ['a'], ['c']])).toEqual(['a', 'b', 'c']);
});

test('a search’s #words are tags that must all match', () => {
  expect(parseQuery('#Fox  lazy #to-read dog')).toEqual({
    text: 'lazy dog',
    tags: ['fox', 'to-read'],
  });
  expect(formatQuery({ text: 'lazy', tags: ['fox'] })).toBe('#fox lazy');
  expect(parseQuery('#')).toEqual({ text: '#', tags: [] });
});

test('searches by tag, and by text in tags', async () => {
  await extensionStorage(() => ({ url: URL, title: 'A post' })).save(URL, [
    annotation('a', { meta: { tags: ['fox', 'animals'] } }),
    annotation('b', { meta: { tags: ['animals'] } }),
    annotation('c'),
  ]);
  const ids = async (query: string) =>
    search(await listPages(), query).flatMap((p) => p.annotations.map((a) => a.id));
  expect(await ids('#animals')).toEqual(['a', 'b']);
  expect(await ids('#animals #fox')).toEqual(['a']);
  expect(await ids('#nothing')).toEqual([]);
  expect(await ids('anim')).toEqual(['a', 'b']);
});

test('setting tags keeps the rest of meta, and marks the highlight changed', async () => {
  await extensionStorage(() => ({ url: URL, title: 'A post' })).save(URL, [
    annotation('a', { meta: { source: 'web' } }),
    annotation('b'),
  ]);
  const [page] = await listPages();
  await setTags(page!, 'a', ['fox']);
  const [after] = await listPages();
  expect(after!.annotations[0]).toMatchObject({ meta: { source: 'web', tags: ['fox'] } });
  expect(after!.annotations[0]!.updatedAt > '2026-01-01').toBe(true);
  expect(after!.annotations[1]).toEqual(annotation('b'));
});
