import { expect, type Page, test } from '@playwright/test';

/** The client rects of the first occurrence of `text` in the article. */
function rectOf(page: Page, text: string) {
  return page.evaluate((text) => {
    const walker = document.createTreeWalker(document.getElementById('article')!, 4);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const i = n.data.indexOf(text);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + text.length);
      const { left, top, right, bottom } = r.getBoundingClientRect();
      return { left, top, right, bottom };
    }
    throw new Error(`"${text}" not found`);
  }, text);
}

/** Text painted in each penciled highlight registry. */
const painted = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...CSS.highlights]
        .filter(([name]) => name !== 'penciled-active')
        .map(([name, h]) => [name, [...h].map((r) => (r as Range).toString()).sort()]),
    ),
  );

/** Selects `text` as the reader would: dragging the mouse, or touching and adjusting handles. */
async function select(page: Page, text: string, touch: boolean) {
  const r = await rectOf(page, text);
  const y = (r.top + r.bottom) / 2;
  if (touch) {
    // Playwright can't long-press to select, so tap (as the long-press begins), then set the
    // range the selection handles would produce.
    await page.touchscreen.tap(r.left + 1, y);
    await page.evaluate((text) => {
      const walker = document.createTreeWalker(document.getElementById('article')!, 4);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        const i = n.data.indexOf(text);
        if (i >= 0) getSelection()!.setBaseAndExtent(n, i, n, i + text.length);
      }
    }, text);
  } else {
    await page.mouse.move(r.left + 1, y);
    await page.mouse.down();
    await page.mouse.move((r.left + r.right) / 2, y, { steps: 4 });
    await page.mouse.move(r.right - 1, y, { steps: 4 });
    await page.mouse.up();
  }
}

/** Clicks or taps on the middle of `text`. */
async function press(page: Page, text: string, touch: boolean) {
  const r = await rectOf(page, text);
  const [x, y] = [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const card = (page: Page) => page.locator('[data-penciled-popover]:not([role=tooltip])');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('select → highlight → note → reload → edit → delete', async ({ page, isMobile }) => {
  const toolbar = page.getByRole('toolbar', { name: 'Annotation' });
  const tap = (name: string) => toolbar.getByRole('button', { name, exact: true }).click();

  // Select and highlight.
  await select(page, 'marvelous proof', isMobile);
  await expect(toolbar).toBeVisible();
  await tap('Highlight green');
  await expect.poll(() => painted(page)).toEqual({ 'penciled-green': ['marvelous proof'] });
  expect(await page.evaluate(() => getSelection()!.isCollapsed)).toBe(true);

  // Add a note.
  await press(page, 'marvelous', isMobile);
  await expect(toolbar.getByRole('button', { name: 'Highlight green' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await tap('Add note');
  const field = page.getByRole('textbox', { name: 'Note' });
  await expect(field).toBeFocused();
  await field.fill('Fermat’s last theorem');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(card(page)).toBeHidden();

  // Reload: everything is restored.
  await page.reload();
  await expect.poll(() => painted(page)).toEqual({ 'penciled-green': ['marvelous proof'] });
  await press(page, 'proof', isMobile);
  await expect(card(page).locator('[data-penciled-note]')).toHaveText('Fermat’s last theorem');

  // Edit the note and the color.
  await tap('Highlight blue');
  await tap('Edit note');
  await field.fill('Proved by Andrew Wiles in 1994');
  await field.press('ControlOrMeta+Enter');
  await page.reload();
  await expect.poll(() => painted(page)).toEqual({ 'penciled-blue': ['marvelous proof'] });
  await press(page, 'proof', isMobile);
  await expect(card(page).locator('[data-penciled-note]')).toHaveText(
    'Proved by Andrew Wiles in 1994',
  );

  // Delete.
  await tap('Remove');
  await expect(card(page)).toBeHidden();
  await expect.poll(() => painted(page)).toEqual({});
  await page.reload();
  await expect.poll(() => painted(page)).toEqual({});
  expect(await page.evaluate(() => localStorage.getItem('penciled:e2e'))).toBe(
    JSON.stringify({ version: 1, annotations: [] }),
  );
});

test('the toolbar sits above the selection, or below it on touch devices', async ({
  page,
  isMobile,
}) => {
  await select(page, 'small act of attention', isMobile);
  const toolbar = page.getByRole('toolbar', { name: 'Annotation' });
  await expect(toolbar).toBeVisible();
  // Let placement settle after the enter transition.
  await page.waitForTimeout(300);
  const text = await rectOf(page, 'small act of attention');
  const box = (await card(page).boundingBox())!;
  if (isMobile) expect(box.y).toBeGreaterThanOrEqual(text.bottom);
  else expect(box.y + box.height).toBeLessThanOrEqual(text.top);
  // Stays within the viewport.
  const { width } = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});

test('the note editor closes where it is after saving', async ({ page, isMobile }) => {
  await select(page, 'small act of attention', isMobile);
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByRole('textbox', { name: 'Note' }).fill('Marginalia');
  await page.waitForTimeout(300);
  const before = (await card(page).boundingBox())!;
  // Record where the card is painted on each frame of its exit transition.
  const frames = page.evaluate(
    () =>
      new Promise<{ x: number; y: number }[]>((resolve) => {
        const out: { x: number; y: number }[] = [];
        const frame = () => {
          const el = document.querySelector('[data-penciled-popover]:not([role=tooltip])');
          if (!el) return resolve(out);
          const { x, y } = el.getBoundingClientRect();
          out.push({ x, y });
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
  await page.getByRole('button', { name: /Save/ }).click();
  for (const { x, y } of await frames) {
    expect(Math.abs(x - before.x)).toBeLessThan(20);
    expect(Math.abs(y - before.y)).toBeLessThan(20);
  }
});

test('the note preview appears on hover with a mouse', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover previews are for mouse users.');
  await page.evaluate(() => {
    const note = {
      version: 1,
      id: 'n1',
      quote: 'act of attention',
      prefix: 'A marginal note is a small ',
      suffix: ': it marks the exact',
      start: 0,
      end: 0,
      color: 'yellow',
      note: 'Also called marginalia',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    localStorage.setItem('penciled:e2e', JSON.stringify({ version: 1, annotations: [note] }));
  });
  await page.reload();
  const r = await rectOf(page, 'act of attention');
  await page.mouse.move(r.left + 5, (r.top + r.bottom) / 2);
  await expect(page.getByRole('tooltip')).toHaveText('Also called marginalia');
  await page.mouse.move(5, 5);
  await expect(page.getByRole('tooltip')).toBeHidden();
});

test('keyboard: Alt+] focuses an annotation, Alt+A enters the toolbar, Esc closes', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Keyboard shortcuts need a keyboard.');
  await select(page, 'marvelous proof', false);
  await page.getByRole('button', { name: 'Highlight yellow' }).click();
  await page.mouse.click(5, 5);
  await page.keyboard.press('Alt+BracketRight');
  const toolbar = page.getByRole('toolbar', { name: 'Annotation' });
  await expect(toolbar).toBeVisible();
  await page.keyboard.press('Alt+KeyA');
  await expect(toolbar.getByRole('button', { name: 'Highlight yellow' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(toolbar.getByRole('button', { name: 'Highlight green' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
});
