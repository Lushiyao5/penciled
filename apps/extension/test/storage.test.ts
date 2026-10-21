import type { Annotation } from 'penciled/headless';
import { beforeEach, expect, test } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { extensionStorage, metaKey, pageKey } from '../src/lib/storage.ts';

const ID = 'https://example.com/post';
const page = () => ({ url: `${ID}#intro`, title: 'A post' });

const annotation = (id: string, quote = id): Annotation => ({
  version: 1,
  id,
  quote,
  prefix: '',
  suffix: '',
  start: 0,
  end: quote.length,
  color: 'yellow',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

beforeEach(() => fakeBrowser.reset());

test('stores annotations with the page metadata the notes page lists', async () => {
  const storage = extensionStorage(page);
  await storage.save(ID, [annotation('a'), annotation('b')]);
  expect(await storage.load(ID)).toHaveLength(2);
  const meta = (await browser.storage.local.get(metaKey(ID)))[metaKey(ID)];
  expect(meta).toMatchObject({ url: `${ID}#intro`, title: 'A post', count: 2 });
});

test("applies each change to what is stored, so a tab never overwrites another's", async () => {
  // Two tabs on the same page, each with only its own annotations in memory.
  const one = extensionStorage(page);
  const two = extensionStorage(page);
  await one.create!(ID, annotation('a'));
  await two.create!(ID, annotation('b'));
  await one.update!(ID, { ...annotation('a'), note: 'Edited' });
  expect((await one.load(ID)).map((a) => [a.id, a.note])).toEqual([
    ['b', undefined],
    ['a', 'Edited'],
  ]);
  await two.delete!(ID, 'b');
  expect((await one.load(ID)).map((a) => a.id)).toEqual(['a']);
});

test('changes from one tab apply in order', async () => {
  const storage = extensionStorage(page);
  await Promise.all([
    storage.create!(ID, annotation('a')),
    storage.create!(ID, annotation('b')),
    storage.delete!(ID, 'a'),
  ]);
  expect((await storage.load(ID)).map((a) => a.id)).toEqual(['b']);
});

test('a page with no annotations left is removed, metadata included', async () => {
  const storage = extensionStorage(page);
  await storage.create!(ID, annotation('a'));
  await storage.delete!(ID, 'a');
  expect(await browser.storage.local.get([pageKey(ID), metaKey(ID)])).toEqual({});
});
