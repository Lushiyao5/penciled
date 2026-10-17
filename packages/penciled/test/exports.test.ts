import { expect, test } from 'vitest';
import * as headless from '../src/headless.ts';
import * as main from '../src/index.ts';

test('entry points load in the browser', () => {
  expect(main).toBeTypeOf('object');
  expect(headless).toBeTypeOf('object');
});

test('runs in a browser with the CSS Custom Highlight API', () => {
  expect(typeof CSS.highlights).toBe('object');
});
