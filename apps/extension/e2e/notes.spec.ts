import { readFile } from 'node:fs/promises';
import { expect, painted, store, stored, test } from './fixtures.ts';

const ARTICLE = 'http://localhost:5180/article.html';
const DARK = 'http://localhost:5180/dark.html';
const annotation = (id: string, quote: string, extra = {}) => ({
  version: 1,
  id,
  quote,
  prefix: '',
  suffix: '',
  start: 0,
  end: quote.length,
  color: 'c2',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});
const meta = (url: string, title: string) => ({
  url,
  title,
  count: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

test.beforeEach(async ({ background }) => {
  await store(background, 'local', {
    [`page:${ARTICLE}`]: {
      version: 1,
      annotations: [
        annotation('a', 'lazy dog', { note: 'Very lazy.' }),
        annotation('b', 'bushy tail', { start: 140, end: 150 }),
      ],
    },
    [`meta:${ARTICLE}`]: meta(`${ARTICLE}#top`, 'An article'),
    [`page:${DARK}`]: { version: 1, annotations: [annotation('c', 'night owls')] },
    [`meta:${DARK}`]: meta(DARK, 'A dark page'),
  });
});

test('lists every highlight by site and page, and searches them', async ({
  context,
  extension,
}) => {
  const notes = await context.newPage();
  await notes.goto(`${extension}/options.html`);
  await expect(notes.getByRole('link', { name: 'Notes' })).toHaveAttribute('aria-current', 'page');
  await expect(notes.getByRole('heading', { level: 2 })).toHaveText(['localhost']);
  await expect(notes.getByRole('heading', { level: 3 })).toHaveText(['An article', 'A dark page']);
  await expect(notes.getByRole('listitem')).toHaveText([
    /lazy dog.*Very lazy\./,
    /bushy tail/,
    /night owls/,
  ]);
  await expect(notes.getByText('saved only in this browser')).toBeVisible();

  const search = notes.getByRole('searchbox');
  await search.fill('LAZY');
  await expect(notes.getByRole('listitem')).toHaveText([/lazy dog/]);
  // Notes are searched too.
  await search.fill('very');
  await expect(notes.getByRole('listitem')).toHaveText([/lazy dog/]);
  await search.fill('zebra');
  await expect(notes.getByText('Nothing matches “zebra”.')).toBeVisible();
});

test('opens a highlight in a new tab, scrolled to it', async ({ context, extension }) => {
  const notes = await context.newPage();
  await notes.goto(`${extension}/options.html`);
  const opened = context.waitForEvent('page');
  await notes
    .getByRole('listitem')
    .filter({ hasText: 'bushy tail' })
    .getByRole('button', { name: 'Open' })
    .click();
  const page = await opened;
  // The address the page was annotated at, which the notes page links to.
  await expect(page).toHaveURL(`${ARTICLE}#top`);
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-active': ['bushy tail'] });
});

test('deleting a highlight removes it from tabs open on the page', async ({
  context,
  background,
  extension,
}) => {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await expect
    .poll(() => painted(page))
    .toMatchObject({ 'penciled-c2': ['lazy dog', 'bushy tail'] });

  const notes = await context.newPage();
  await notes.goto(`${extension}/options.html`);
  await notes
    .getByRole('listitem')
    .filter({ hasText: 'lazy dog' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(notes.getByRole('listitem')).toHaveCount(2);
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['bushy tail'] });

  // Deleting a page's last highlight removes the page.
  await notes
    .getByRole('listitem')
    .filter({ hasText: 'night owls' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(notes.getByRole('heading', { level: 3 })).toHaveText(['An article']);
  const keys = Object.keys(await stored(background));
  expect(keys.filter((k) => k.includes('dark'))).toEqual([]);
});

test('exports a backup that restores everything', async ({ context, background, extension }) => {
  const notes = await context.newPage();
  await notes.goto(`${extension}/options.html`);

  const markdown = notes.waitForEvent('download');
  await notes.getByRole('button', { name: 'Export as Markdown' }).click();
  const md = await readFile((await (await markdown).path())!, 'utf8');
  expect(md).toContain(`### [An article](<${ARTICLE}#top>)\n\n> lazy dog\n\nVery lazy.`);

  const json = notes.waitForEvent('download');
  await notes.getByRole('button', { name: 'Export a backup' }).click();
  const file = await (await json).path();
  expect((await json).suggestedFilename()).toMatch(/^penciled-\d{4}-\d\d-\d\d\.json$/);

  await background.evaluate(() =>
    (
      globalThis as unknown as { chrome: typeof import('wxt/browser').browser }
    ).chrome.storage.local.clear(),
  );
  await expect(notes.getByText('Nothing highlighted yet.')).toBeVisible();

  const chooser = notes.waitForEvent('filechooser');
  await notes.getByRole('button', { name: 'Import a backup' }).click();
  await (await chooser).setFiles(file!);
  await expect(notes.getByRole('status')).toHaveText('Imported 3 highlights.');
  await expect(notes.getByRole('listitem')).toHaveCount(3);

  const page = await context.newPage();
  await page.goto(ARTICLE);
  await expect
    .poll(() => painted(page))
    .toMatchObject({ 'penciled-c2': ['lazy dog', 'bushy tail'] });
});

test('refuses files that are not backups', async ({ context, extension }) => {
  const notes = await context.newPage();
  await notes.goto(`${extension}/options.html`);
  const chooser = notes.waitForEvent('filechooser');
  await notes.getByRole('button', { name: 'Import a backup' }).click();
  await (await chooser).setFiles({
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"nope":1}'),
  });
  await expect(notes.getByRole('status')).toHaveText('This file isn’t a penciled backup.');
});
