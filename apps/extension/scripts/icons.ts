/**
 * Renders the extension's icons from the penciled logo: `node scripts/icons.ts`.
 *
 * The 128 px icon follows the Chrome Web Store's guidelines: 96 px of artwork with 16 px of
 * transparent padding. Smaller icons, shown in the toolbar, fill their whole square.
 */
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const logo = (size: number, inset: number) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-inset} ${-inset} ${32 + 2 * inset} ${32 + 2 * inset}">
    <rect width="32" height="32" rx="8" fill="#1c1b19"/>
    <path d="M7.5 19.5c5.5-1.8 11-2.2 17-1.2" fill="none" stroke="#fde047" stroke-width="3.2" stroke-linecap="round"/>
  </svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  // 16 px of 128 is an eighth of the artwork's side on each edge: 32 / 6 user units.
  const inset = size === 128 ? 32 / 6 : 0;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>body { margin: 0 } svg { display: block }</style>${logo(size, inset)}`,
  );
  await page.locator('svg').screenshot({
    path: resolve(import.meta.dirname, `../public/icon/${size}.png`),
    omitBackground: true,
  });
}
await browser.close();
