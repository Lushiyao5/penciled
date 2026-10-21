/**
 * Measures what penciled costs on real pages: `pnpm bench <url> [url…]`.
 *
 * Each page is loaded in Chromium and annotated on `body`, the way the browser extension does it.
 * Reported per page:
 * - text: characters of visible text on the page
 * - empty walks: index builds during the first `WATCH` ms with no annotations (should be 0)
 * - refresh: median time to rebuild the index and re-anchor `COUNT` annotations
 * - refreshes: refreshes triggered by the page's own DOM changes during `WATCH` ms
 * - main thread: the share of `WATCH` ms spent on those refreshes
 *
 * Pages that keep changing (feeds, tickers, live scores) are the interesting ones.
 */
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const COUNT = 50;
const WATCH = Number(process.env.WATCH ?? 10_000);
// Local files, like bench/busy.html, are opened as file: URLs.
const urls = process.argv.slice(2).map((u) => (/^\w+:/.test(u) ? u : pathToFileURL(u).href));
if (!urls.length) {
  console.error('Usage: pnpm bench <url> [url…]');
  process.exit(1);
}

const [out] = (await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: true,
    lib: { entry: 'src/headless.ts', formats: ['iife'], name: 'penciled' },
  },
})) as { output: { code: string }[] }[];
const script = out!.output[0]!.code;

const browser = await chromium.launch();
const rows = [];
for (const url of urls) {
  // Some pages forbid inline scripts.
  const page = await browser.newPage({ bypassCSP: true });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(2000);
    await page.addScriptTag({ content: script });
    rows.push({
      url,
      ...(await page.evaluate(
        async ({ COUNT, WATCH }) => {
          const { annotate } = (
            window as unknown as { penciled: typeof import('../src/headless.ts') }
          ).penciled;
          let walks = 0;
          const walker = document.createTreeWalker.bind(document);
          document.createTreeWalker = (...args: Parameters<typeof walker>) => {
            walks++;
            return walker(...args);
          };
          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
          const instance = annotate(document.body, { documentId: 'bench', storage: 'memory' });
          await instance.ready;
          await sleep(WATCH);
          const empty = walks;

          // Annotate the start of COUNT text nodes spread over the page.
          const texts: Text[] = [];
          const all = walker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = all.nextNode(); n; n = all.nextNode()) {
            const t = n as Text;
            if (t.data.trim().length >= 24 && t.parentElement?.checkVisibility()) texts.push(t);
          }
          for (let i = 0; i < COUNT && texts.length; i++) {
            const t = texts[Math.floor((i * texts.length) / COUNT)]!;
            const start = t.data.search(/\S/);
            const range = document.createRange();
            range.setStart(t, start);
            range.setEnd(t, start + 20);
            instance.create(range);
          }

          const times = Array.from({ length: 7 }, () => {
            const t = performance.now();
            instance.refresh();
            return performance.now() - t;
          }).sort((a, b) => a - b);
          const refresh = times[3]!;
          walks = 0;
          await sleep(WATCH);
          const annotations = instance.export().annotations.length;
          instance.destroy();
          return {
            text: document.body.innerText.length,
            annotations,
            'empty walks': empty,
            'refresh ms': +refresh.toFixed(1),
            refreshes: walks,
            'main thread': `${((100 * walks * refresh) / WATCH).toFixed(1)}%`,
          };
        },
        { COUNT, WATCH },
      )),
    });
  } catch (e) {
    rows.push({ url, error: (e as Error).message.split('\n')[0] });
  } finally {
    await page.close();
  }
}
await browser.close();
console.table(rows);
