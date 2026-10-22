import type { Annotation } from 'penciled/headless';
import { beforeEach, expect, test } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createBackup, restoreBackup, toMarkdown } from '../src/lib/backup.ts';
import { listPages } from '../src/lib/pages.ts';
import { getSettings, saveSettings } from '../src/lib/settings.ts';
import { extensionStorage } from '../src/lib/storage.ts';

const URL_A = 'https://example.com/post';
const URL_B = 'https://news.example.org/story';

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

const save = (url: string, annotations: Annotation[], title = 'A page') =>
  extensionStorage(() => ({ url, title })).save(url, annotations);

const stored = async () =>
  Object.fromEntries((await listPages()).map((p) => [p.id, p.annotations]));

beforeEach(() => fakeBrowser.reset());

test('a backup restores everything into an empty browser', async () => {
  await save(URL_A, [annotation('a', { note: 'Mine' })], 'Post');
  await save(URL_B, [annotation('b')]);
  const backup = JSON.parse(JSON.stringify(await createBackup()));

  fakeBrowser.reset();
  expect(await restoreBackup(backup)).toBe(2);
  expect(await stored()).toEqual({
    [URL_A]: [annotation('a', { note: 'Mine' })],
    [URL_B]: [annotation('b')],
  });
  expect((await listPages()).find((p) => p.id === URL_A)).toMatchObject({ title: 'Post' });
});

test('restoring keeps whichever copy of a highlight changed last', async () => {
  await save(URL_A, [
    annotation('old', { note: 'Here' }),
    annotation('new', { note: 'Here', updatedAt: '2026-03-01T00:00:00.000Z' }),
  ]);
  const backup = {
    ...(await createBackup()),
    pages: [
      {
        url: URL_A,
        title: 'A page',
        annotations: [
          annotation('old', { note: 'Backup', updatedAt: '2026-02-01T00:00:00.000Z' }),
          annotation('new', { note: 'Backup', updatedAt: '2026-02-01T00:00:00.000Z' }),
          annotation('added'),
        ],
      },
    ],
  };
  expect(await restoreBackup(backup)).toBe(2);
  const notes = (await stored())[URL_A]!.map((a) => [a.id, a.note]);
  expect(notes).toEqual([
    ['old', 'Backup'],
    ['new', 'Here'],
    ['added', undefined],
  ]);
  expect(await restoreBackup(backup)).toBe(0);
});

test('invalid highlights and pages are skipped', async () => {
  const backup = {
    ...(await createBackup()),
    pages: [
      { url: 'not a url', title: '', annotations: [annotation('x')] },
      null,
      { url: URL_A, title: 'A page', annotations: [{ quote: 3 }, 'nope', { quote: 'kept' }] },
    ],
  };
  expect(await restoreBackup(backup)).toBe(1);
  expect((await stored())[URL_A]).toEqual([
    expect.objectContaining({ quote: 'kept', color: 'c1' }),
  ]);
});

test('files that are not backups are refused', async () => {
  for (const data of [null, [], { annotations: [] }, { format: 'other', pages: [] }]) {
    await expect(restoreBackup(data)).rejects.toThrow('isn’t a penciled backup');
  }
  await expect(
    restoreBackup({ format: 'penciled-extension', version: 2, pages: [] }),
  ).rejects.toThrow('newer version');
});

test('highlights keep their color in a browser whose palette differs', async () => {
  const backup = {
    ...(await createBackup()),
    colors: [
      { id: 'c1', label: 'Yellow', value: '#fde047' },
      // Another browser's c2 is this one's c3.
      { id: 'c2', label: 'Blue', value: '#93C5FD' },
      { id: 'c6', label: 'Orange', value: '#fdba74' },
    ],
    pages: [
      {
        url: URL_A,
        title: '',
        annotations: [
          annotation('a', { color: 'c1' }),
          annotation('b', { color: 'c2' }),
          annotation('c', { color: 'c6' }),
          annotation('d', { color: 'c9' }),
        ],
      },
    ],
  };
  await restoreBackup(backup);
  expect((await stored())[URL_A]!.map((a) => a.color)).toEqual(['c1', 'c3', 'c6', 'c1']);
  // Added, but not offered for new highlights.
  expect((await getSettings()).colors.at(-1)).toEqual({
    id: 'c6',
    label: 'Orange',
    value: '#fdba74',
    hidden: true,
  });

  // Here c6 is already taken by another color.
  fakeBrowser.reset();
  const { colors } = await getSettings();
  await saveSettings({ colors: [...colors, { id: 'c6', label: 'Teal', value: '#5eead4' }] });
  await restoreBackup(backup);
  expect((await stored())[URL_A]![2]!.color).toBe('c7');
});

test('Markdown lists highlights by site and page', async () => {
  await save(
    URL_A,
    [annotation('a', { note: 'First note', meta: { tags: ['to-read', 'fox'] } })],
    'A [great] post',
  );
  await save(URL_B, [annotation('b')], '');
  const markdown = toMarkdown(await listPages());
  expect(markdown).toContain(
    '## example.com\n\n### [A \\[great\\] post](<https://example.com/post>)',
  );
  expect(markdown).toContain('> quote a\n\nFirst note\n\n#to-read #fox');
  expect(markdown).toContain(`### [${URL_B}](<${URL_B}>)\n\n> quote b`);
});

test('the open request is used once, by the page it is for', async () => {
  const { openAnnotation, takeOpened } = await import('../src/lib/pages.ts');
  await save(URL_A, [annotation('a')]);
  const [page] = await listPages();
  await openAnnotation(page!, 'a').catch(() => {});
  expect(await takeOpened(URL_B)).toBeUndefined();
  expect(await takeOpened(URL_A)).toBe('a');
  expect(await takeOpened(URL_A)).toBeUndefined();
  expect(await browser.storage.local.get('open')).toEqual({});
});
