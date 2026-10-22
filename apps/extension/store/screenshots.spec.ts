import type { Page } from '@playwright/test';
import { select, store, test } from '../e2e/fixtures.ts';

// The size both stores ask for.
const SIZE = { width: 1280, height: 800 };
const out = (name: string) => `${import.meta.dirname}/screenshots/${name}.png`;
const promo = (name: string) => `${import.meta.dirname}/promo/${name}.png`;
const action = (key: string) => `[data-penciled-action="${key}"]`;

async function highlight(page: Page, text: string, color: string, note?: string) {
  await select(page, text);
  if (note) {
    await page.locator(action('note')).click();
    await page.locator('[data-penciled-popover] textarea').fill(note);
    await page.keyboard.press('ControlOrMeta+Enter');
  } else await page.locator(action(`color-${color}`)).click();
  await page.evaluate(() => getSelection()?.removeAllRanges());
  // Closes the toolbar.
  await page.mouse.click(5, page.viewportSize()!.height - 5);
}

async function article(page: Page) {
  await page.setViewportSize(SIZE);
  await page.goto('/article.html');
  await highlight(page, 'marking a passage forces you to decide what matters', 'c1');
  await highlight(page, 'Bookmarks keep the page, but not the part of it you cared about.', 'c3');
  await highlight(
    page,
    'A highlight is a small act of attention.',
    'c1',
    'This is the whole idea in one line.',
  );
}

test('highlighting', async ({ context }) => {
  const page = await context.newPage();
  await article(page);
  await select(page, 'They never change the page itself');
  await page.locator(action('color-c1')).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('1-highlight') });
});

test('notes on the page', async ({ context }) => {
  const page = await context.newPage();
  await article(page);
  await select(page, 'and with your future self');
  await page.locator(action('note')).click();
  await page.locator('[data-penciled-popover] textarea').fill('Notes are letters to me, later.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('2-note') });
});

test('dark pages', async ({ context }) => {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'dark' });
  await article(page);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await select(page, 'They appear when you select a sentence');
  await page.locator(action('color-c2')).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('3-dark') });
});

test('the notes page', async ({ context, background, extension }) => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 20, 9, minutes)).toISOString();
  const page = (
    url: string,
    title: string,
    minutes: number,
    items: [string, string, string?][],
  ) => ({
    [`page:${url}`]: {
      version: 1,
      annotations: items.map(([quote, color, note], i) => ({
        version: 1,
        id: `${url}-${i}`,
        quote,
        prefix: '',
        suffix: '',
        start: i,
        end: i + 1,
        color,
        ...(note && { note }),
        createdAt: at(minutes),
        updatedAt: at(minutes),
      })),
    },
    [`meta:${url}`]: { url, title, count: items.length, updatedAt: at(minutes) },
  });
  await store(background, 'local', {
    ...page('https://slowreader.example/pencil', 'Reading with a pencil in hand', 50, [
      ['marking a passage forces you to decide what matters', 'c1'],
      ['A highlight is a small act of attention.', 'c1', 'This is the whole idea in one line.'],
      ['Bookmarks keep the page, but not the part of it you cared about.', 'c3'],
    ]),
    ...page('https://en.wikipedia.org/wiki/Marginalia', 'Marginalia - Wikipedia', 30, [
      [
        'Marginalia are marks made in the margins of a book or other document.',
        'c2',
        'Start of the essay draft.',
      ],
      ['Fermat famously wrote that he had a proof too large to fit in the margin.', 'c4'],
    ]),
    ...page('https://docs.example.dev/guides/caching', 'Caching strategies – Docs', 10, [
      [
        'Stale-while-revalidate serves cached content while fetching an update in the background.',
        'c5',
        'Use for the dashboard API.',
      ],
    ]),
  });
  const notes = await context.newPage();
  await notes.setViewportSize(SIZE);
  await notes.goto(`${extension}/options.html#notes`);
  await notes.getByRole('listitem').first().waitFor();
  await notes.screenshot({ path: out('4-notes') });
});

test('settings', async ({ context, extension }) => {
  const settings = await context.newPage();
  await settings.setViewportSize(SIZE);
  await settings.goto(`${extension}/options.html#settings`);
  await settings.getByRole('heading', { name: 'Colors' }).waitFor();
  await settings.screenshot({ path: out('5-settings') });
});

// The Chrome Web Store's promo tiles.
test('small promo tile', async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 280 });
  await page.goto('/small-tile.html');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: promo('small-tile') });
});

test('marquee promo tile', async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1400, height: 560 });
  await page.goto('/marquee.html');
  await page.evaluate(() => document.fonts.ready);
  await highlight(page, 'A highlight is a small act of attention.', 'c1');
  await highlight(page, 'records why', 'c2');
  await select(page, 'They appear when you select a sentence');
  await page.locator(action('color-c1')).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: promo('marquee') });
});
