import axe from 'axe-core';
import { afterEach, expect, test } from 'vitest';
import '../src/styles.css';
import { type AnnotateOptions, annotate } from '../src/index.ts';
import { cleanup, clickOn, find, mount, selectText, track, wait } from './helpers.ts';

afterEach(cleanup);

const TEXT = '<p style="font: 20px/1.5 monospace">The quick brown fox jumps over the lazy dog.</p>';

async function setup(options: AnnotateOptions = {}) {
  const { root } = mount(TEXT);
  const instance = track(annotate(root, { storage: 'memory', ...options }));
  await instance.ready;
  return { root, instance };
}

/** Runs axe on penciled's UI: the popovers and the live region. */
async function check() {
  // Let the enter transition finish, so colors are measured at full opacity.
  await wait(250);
  const { violations } = await axe.run(
    { include: [['[data-penciled]']] },
    { resultTypes: ['violations'] },
  );
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(', ')}`)).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`toolbar for a selection (${theme})`, async () => {
    const { root } = await setup({ theme, actions: ['highlight', 'note', 'copy'] });
    await selectText(find(root, 'brown fox'));
    await check();
  });

  test(`toolbar for an annotation with a note (${theme})`, async () => {
    const { root, instance } = await setup({ theme, actions: ['highlight', 'note', 'remove'] });
    instance.create(find(root, 'quick'), { note: 'A note' });
    clickOn(find(root, 'quick'));
    await check();
  });

  test(`note editor (${theme})`, async () => {
    const { root } = await setup({ theme });
    await selectText(find(root, 'brown fox'));
    document.querySelector<HTMLButtonElement>('[data-penciled-action="note"]')!.click();
    await check();
  });
}

test('read-only note', async () => {
  const { root, instance } = await setup({ readOnly: true });
  instance.create(find(root, 'quick'), { note: 'Read me' });
  clickOn(find(root, 'quick'));
  await check();
});
