import { expect, test } from 'vitest';

test('every entry imports without a DOM', async () => {
  expect(typeof window).toBe('undefined');
  expect(typeof document).toBe('undefined');
  const headless = await import('../src/headless.ts');
  const main = await import('../src/index.ts');
  await import('../src/react/index.ts');
  expect(typeof headless.annotate).toBe('function');
  expect(typeof main.annotate).toBe('function');
});

test('the W3C converters work on the server', async () => {
  const { fromW3C, toW3C } = await import('../src/headless.ts');
  const [a] = fromW3C({ target: { selector: { type: 'TextQuoteSelector', exact: 'hi' } } });
  expect(fromW3C(toW3C([a!], { source: 'https://example.com' }))).toEqual([a]);
});
