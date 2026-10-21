import { expect, painted, send, store, stored, tabId, test } from './fixtures.ts';

const ARTICLE = 'http://localhost:5180/article.html';
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

test.beforeEach(async ({ background }) => {
  await store(background, 'local', {
    [`page:${ARTICLE}`]: {
      version: 1,
      annotations: [
        annotation('a', 'lazy dog', { note: 'Very lazy.' }),
        annotation('b', 'a sentence that was edited away'),
      ],
    },
  });
});

test('lists the page’s highlights; opens them, and deletes ones that can’t be found', async ({
  context,
  background,
  extension,
}) => {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });

  const popup = await context.newPage();
  await popup.goto(`${extension}/popup.html?tab=${await tabId(background, page)}`);
  const items = popup.getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('lazy dog');
  await expect(items.first()).toContainText('Very lazy.');
  await expect(items.last()).toContainText('Couldn’t find this on the page.');

  await items.last().getByRole('button', { name: 'Delete' }).click();
  await expect(items).toHaveCount(1);
  await expect
    .poll(() => stored(background))
    .toMatchObject({ [`page:${ARTICLE}`]: { annotations: [{ id: 'a' }] } });

  await items.first().getByRole('button').click();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-active': ['lazy dog'] });
});

test('turns penciled off for a site, and back on from the settings', async ({
  context,
  background,
  extension,
}) => {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });

  const popup = await context.newPage();
  await popup.goto(`${extension}/popup.html?tab=${await tabId(background, page)}`);
  await popup.getByRole('switch').uncheck();
  await expect(popup.getByText('penciled is off on localhost')).toBeVisible();
  await expect.poll(() => painted(page)).toEqual({});
  await page.reload();
  await page.waitForTimeout(300);
  expect(await painted(page)).toEqual({});
  // Nothing at all is added to a page where penciled is off.
  expect(await page.locator('penciled-ui').count()).toBe(0);
  // The highlights are kept.
  expect(Object.keys(await stored(background))).toContain(`page:${ARTICLE}`);

  const settings = await context.newPage();
  await settings.goto(`${extension}/options.html`);
  await settings.getByRole('button', { name: 'Turn back on' }).click();
  await expect(settings.getByText('penciled runs on every site')).toBeVisible();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });
});

test('the shortcut hides highlights on one tab until pressed again', async ({
  context,
  background,
  extension,
}) => {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });
  await send(background, page, { type: 'toggle' });
  await expect.poll(() => painted(page)).toEqual({});

  const popup = await context.newPage();
  await popup.goto(`${extension}/popup.html?tab=${await tabId(background, page)}`);
  await expect(popup.getByText('Highlights are hidden on this tab')).toBeVisible();

  await send(background, page, { type: 'toggle' });
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });
  expect(Object.keys(await stored(background))).toContain(`page:${ARTICLE}`);
});

test('shows why it can’t run on the browser’s own pages', async ({ context, extension }) => {
  const popup = await context.newPage();
  // A tab with no content script: the popup's own.
  await popup.goto(`${extension}/popup.html?tab=999999`);
  await expect(popup.getByText('penciled can’t run on this page')).toBeVisible();
});
