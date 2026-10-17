import { afterEach, describe, expect, test, vi } from 'vitest';
import '../src/styles.css';
import { type AnnotateOptions, annotate } from '../src/index.ts';
import { cleanup, clickOn, find, mount, painted, selectText, track, wait } from './helpers.ts';

afterEach(cleanup);

const TEXT = '<p style="font: 20px/1.5 monospace">The quick brown fox jumps over the lazy dog.</p>';

async function setup(options: AnnotateOptions = {}, html = TEXT) {
  const { root } = mount(html);
  document.body.append(
    Object.assign(document.createElement('p'), { textContent: 'Outside paragraph.' }),
  );
  const instance = track(annotate(root, { storage: 'memory', ...options }));
  await instance.ready;
  return { root, instance };
}

const popover = () =>
  document.querySelector<HTMLElement>('[data-penciled-popover]:not([role=tooltip])');
const shown = () => !!popover() && !popover()!.hasAttribute('data-penciled-closing');
const toolbar = () => popover()?.querySelector<HTMLElement>('[role=toolbar]');
const action = (key: string) =>
  popover()?.querySelector<HTMLButtonElement>(`[data-penciled-action="${key}"]`);
const actions = () =>
  [...(toolbar()?.querySelectorAll('button') ?? [])].map((b) => b.dataset.penciledAction);
const field = () => popover()?.querySelector('textarea');
const press = (key: string, init: KeyboardEventInit = {}) =>
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );

describe('toolbar', () => {
  test('appears on selection without taking focus, and hides when it is dismissed', async () => {
    const { root } = await setup();
    await selectText(find(root, 'brown fox'));
    expect(shown()).toBe(true);
    expect(actions()).toEqual([
      'color-yellow',
      'color-green',
      'color-blue',
      'color-pink',
      'color-purple',
      'note',
    ]);
    expect(toolbar()?.getAttribute('aria-label')).toBe('Annotation');
    expect(action('color-blue')?.getAttribute('aria-label')).toBe('Highlight blue');
    expect(document.activeElement).toBe(document.body);
    await selectText(null);
    expect(shown()).toBe(false);
    await wait(200);
    expect(popover()).toBeNull();
  });

  test('is placed next to the selection', async () => {
    const { root } = await setup({}, `<div style="height: 200px"></div>${TEXT}`);
    const range = find(root, 'brown fox');
    await selectText(range);
    await wait(50);
    const pop = popover()!.getBoundingClientRect();
    const sel = range.getBoundingClientRect();
    expect(pop.bottom).toBeLessThanOrEqual(sel.top);
    expect(pop.bottom).toBeGreaterThan(sel.top - 20);
    expect(popover()!.dataset.penciledSide).toBe('top');
  });

  test('follows the text when the page scrolls', async () => {
    const { root } = await setup(
      {},
      `<div style="height: 200px"></div>${TEXT}<div style="height: 3000px"></div>`,
    );
    await selectText(find(root, 'brown fox'));
    await wait(50);
    const before = popover()!.getBoundingClientRect().top;
    window.scrollBy(0, 100);
    // Polled: the scroll event and the repositioning both land a frame or more later, which can
    // outlast a fixed wait on slow CI machines.
    await expect.poll(() => popover()!.getBoundingClientRect().top).toBeCloseTo(before - 100, 0);
    window.scrollTo(0, 0);
  });

  test('a color highlights the selection and switches to the annotation toolbar', async () => {
    const onCreate = vi.fn();
    const { root, instance } = await setup({ onCreate });
    await selectText(find(root, 'brown fox'));
    action('color-green')!.click();
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ quote: 'brown fox' }));
    expect(painted('penciled-green')).toEqual(['brown fox']);
    expect(getSelection()?.isCollapsed).toBe(true);
    expect(actions()).toContain('remove');
    expect(action('color-green')?.getAttribute('aria-pressed')).toBe('true');
    // The collapsed selection doesn't dismiss the annotation.
    await wait(250);
    expect(shown()).toBe(true);
    expect(instance.getAll()).toHaveLength(1);
  });

  test('clicking a highlight opens it: change color, remove', async () => {
    const { root, instance } = await setup();
    const a = instance.create(find(root, 'quick'))!;
    clickOn(find(root, 'quick'));
    expect(actions()).toEqual([...actions()!.slice(0, 5), 'note', 'remove']);
    action('color-pink')!.click();
    expect(instance.get(a.id)?.color).toBe('pink');
    expect(action('color-pink')?.getAttribute('aria-pressed')).toBe('true');
    action('remove')!.click();
    expect(instance.getAll()).toEqual([]);
    expect(shown()).toBe(false);
  });

  test('clicking outside closes it', async () => {
    const { root, instance } = await setup();
    instance.create(find(root, 'quick'));
    clickOn(find(root, 'quick'));
    expect(shown()).toBe(true);
    clickOn(find(document.body, 'Outside'));
    expect(shown()).toBe(false);
  });

  test('actions: copy is opt-in, custom actions receive the context and close the toolbar', async () => {
    const onSelect = vi.fn();
    const { root } = await setup({
      actions: [
        'copy',
        'highlight',
        { id: 'share', label: 'Share', icon: '<svg viewBox="0 0 1 1"></svg>', onSelect },
        { id: 'ask', label: 'Ask', onSelect },
      ],
    });
    await selectText(find(root, 'lazy dog'));
    expect(actions()).toEqual([
      'copy',
      'color-yellow',
      'color-green',
      'color-blue',
      'color-pink',
      'color-purple',
      'share',
      'ask',
    ]);
    // Markup without xmlns still renders as SVG.
    expect(action('share')!.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(action('ask')!.textContent).toBe('Ask');
    action('share')!.click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'lazy dog' }));
    expect(shown()).toBe(false);
  });

  test('labels replace every string', async () => {
    const { root } = await setup({
      labels: { toolbar: 'Anmerkung', highlight: '{color} markieren', note: 'Notiz' },
      colors: [{ name: 'yellow', label: 'Gelb' }],
    });
    await selectText(find(root, 'quick'));
    expect(toolbar()?.getAttribute('aria-label')).toBe('Anmerkung');
    expect(action('color-yellow')?.getAttribute('aria-label')).toBe('Gelb markieren');
    expect(action('note')?.getAttribute('aria-label')).toBe('Notiz');
  });
});

describe('note editor', () => {
  test('adds a note to a selection; Ctrl/Cmd+Enter saves', async () => {
    const { root, instance } = await setup();
    await selectText(find(root, 'brown fox'));
    action('note')!.click();
    expect(document.activeElement).toBe(field());
    field()!.value = '  Foxes are <b>quick</b>.  ';
    press('Enter', { ctrlKey: true });
    const [a] = instance.getAll();
    expect(a).toMatchObject({
      quote: 'brown fox',
      color: 'yellow',
      note: 'Foxes are <b>quick</b>.',
    });
    expect(shown()).toBe(false);

    // The note is shown as text when the highlight is reopened.
    clickOn(find(root, 'brown'));
    const note = popover()!.querySelector('[data-penciled-note]')!;
    expect(note.textContent).toBe('Foxes are <b>quick</b>.');
    expect(note.querySelector('b')).toBeNull();
    expect(action('note')?.getAttribute('aria-label')).toBe('Edit note');
  });

  test('Esc cancels, and drops a highlight created only for the note', async () => {
    const onCreate = vi.fn();
    const onDelete = vi.fn();
    const { root, instance } = await setup({ onCreate, onDelete });
    await selectText(find(root, 'brown fox'));
    action('note')!.click();
    field()!.value = 'Never mind';
    press('Escape');
    expect(instance.getAll()).toEqual([]);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(shown()).toBe(false);
  });

  test('editing an existing note: Esc keeps it, clicking outside saves changes', async () => {
    const { root, instance } = await setup();
    const a = instance.create(find(root, 'quick'), { note: 'Original' })!;
    clickOn(find(root, 'quick'));
    action('note')!.click();
    expect(field()!.value).toBe('Original');
    field()!.value = 'Changed';
    press('Escape');
    expect(instance.get(a.id)?.note).toBe('Original');

    clickOn(find(root, 'quick'));
    action('note')!.click();
    field()!.value = 'Changed';
    clickOn(find(document.body, 'Outside'));
    expect(instance.get(a.id)?.note).toBe('Changed');
    expect(shown()).toBe(false);
  });

  test('saving an empty note removes it; the Save button works', async () => {
    const { root, instance } = await setup();
    const a = instance.create(find(root, 'quick'), { note: 'Gone soon' })!;
    clickOn(find(root, 'quick'));
    action('note')!.click();
    field()!.value = '';
    popover()!.querySelector<HTMLButtonElement>('[data-penciled-primary]')!.click();
    expect(instance.get(a.id)).toBeDefined();
    expect(instance.get(a.id)?.note).toBeUndefined();
  });

  test('grows with its content and honors maxNoteLength', async () => {
    const { root } = await setup({ maxNoteLength: 20 });
    await selectText(find(root, 'quick'));
    action('note')!.click();
    expect(field()!.maxLength).toBe(20);
    const before = field()!.offsetHeight;
    field()!.value = 'a\nb\nc\nd\ne';
    field()!.dispatchEvent(new Event('input'));
    expect(field()!.offsetHeight).toBeGreaterThan(before);
  });

  test('the selection is not dismissed while typing', async () => {
    const { root } = await setup();
    await selectText(find(root, 'quick'));
    action('note')!.click();
    field()!.setSelectionRange(0, 0);
    await wait(250);
    expect(field()?.isConnected).toBe(true);
  });
});

describe('keyboard', () => {
  test('Alt+A moves focus in, arrows rove, Esc closes and returns focus', async () => {
    const { root } = await setup({}, `${TEXT}<button id="before">Before</button>`);
    const before = document.getElementById('before')!;
    before.focus();
    await selectText(find(root, 'quick'));
    expect(document.activeElement).toBe(before);
    press('a', { code: 'KeyA', altKey: true });
    expect(document.activeElement).toBe(action('color-yellow'));
    press('ArrowRight');
    expect(document.activeElement).toBe(action('color-green'));
    expect(action('color-green')!.tabIndex).toBe(0);
    expect(action('color-yellow')!.tabIndex).toBe(-1);
    press('ArrowLeft');
    press('ArrowLeft');
    expect(document.activeElement).toBe(action('note'));
    press('Home');
    expect(document.activeElement).toBe(action('color-yellow'));
    press('Escape');
    expect(shown()).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  test('keeps focus on the same action when the toolbar re-renders', async () => {
    const { root } = await setup();
    await selectText(find(root, 'quick'));
    press('a', { code: 'KeyA', altKey: true });
    press('ArrowRight');
    (document.activeElement as HTMLButtonElement).click();
    expect(actions()).toContain('remove');
    expect(document.activeElement).toBe(action('color-green'));
  });

  test('Alt+] and Alt+[ cycle through annotations and announce them', async () => {
    const { root, instance } = await setup();
    instance.create(find(root, 'lazy'), { note: 'A note' });
    instance.create(find(root, 'quick'));
    const live = document.querySelector('[data-penciled-live]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    press(']', { code: 'BracketRight', altKey: true });
    expect(painted('penciled-active')).toEqual(['quick']);
    await new Promise(requestAnimationFrame);
    expect(live.textContent).toBe('Annotation 1 of 2: quick');
    press(']', { code: 'BracketRight', altKey: true });
    expect(painted('penciled-active')).toEqual(['lazy']);
    await new Promise(requestAnimationFrame);
    expect(live.textContent).toBe('Annotation 2 of 2: lazy. A note');
    press('[', { code: 'BracketLeft', altKey: true });
    expect(painted('penciled-active')).toEqual(['quick']);
    expect(shown()).toBe(true);
  });

  test('shortcuts are configurable, or can be turned off', async () => {
    const { root, instance } = await setup({ shortcuts: { next: 'Alt+N' } });
    instance.create(find(root, 'quick'));
    press(']', { code: 'BracketRight', altKey: true });
    expect(CSS.highlights.has('penciled-active')).toBe(false);
    press('n', { code: 'KeyN', altKey: true });
    expect(painted('penciled-active')).toEqual(['quick']);
    instance.destroy();

    const other = await setup({ shortcuts: false });
    other.instance.create(find(other.root, 'quick'));
    press(']', { code: 'BracketRight', altKey: true });
    expect(CSS.highlights.has('penciled-active')).toBe(false);
  });
});

describe('read-only', () => {
  test('shows the note, without editing actions', async () => {
    const { root, instance } = await setup({ readOnly: true });
    instance.create(find(root, 'quick'), { note: 'Read me' });
    instance.create(find(root, 'lazy'));
    clickOn(find(root, 'quick'));
    expect(popover()?.querySelector('[data-penciled-note]')?.textContent).toBe('Read me');
    expect(toolbar()).toBeNull();
    // Nothing to show at all.
    clickOn(find(root, 'lazy'));
    expect(shown()).toBe(false);
  });

  test('editable: false annotations keep non-editing actions', async () => {
    const { root, instance } = await setup({ actions: ['highlight', 'copy', 'remove'] });
    instance.create(find(root, 'quick'), { editable: false });
    clickOn(find(root, 'quick'));
    expect(actions()).toEqual(['copy']);
  });
});

describe('colors and theme', () => {
  test('custom colors are exposed as --penciled-<name> and painted', async () => {
    const { root, instance } = await setup({
      colors: ['yellow', { name: 'mint', light: 'rgb(1, 2, 3)', dark: 'rgb(4, 5, 6)' }],
    });
    expect(getComputedStyle(document.documentElement).getPropertyValue('--penciled-mint')).toMatch(
      /light-dark\(rgb\(1, 2, 3\), rgb\(4, 5, 6\)\)/,
    );
    await selectText(find(root, 'quick'));
    action('color-mint')!.click();
    expect(painted('penciled-mint')).toEqual(['quick']);
    // Unknown names fall back to the default color.
    instance.create(find(root, 'lazy'), { color: 'orange' });
    expect(painted('penciled-yellow')).toEqual(['lazy']);
  });

  test('theme and setTheme() set the UI color scheme', async () => {
    const { root, instance } = await setup({ theme: 'dark' });
    await selectText(find(root, 'quick'));
    expect(getComputedStyle(popover()!).colorScheme).toBe('dark');
    instance.setTheme('light');
    expect(getComputedStyle(popover()!).colorScheme).toBe('light');
  });

  test('noteIndicator: underline paints noted annotations separately', async () => {
    const { root, instance } = await setup({ noteIndicator: 'underline' });
    instance.create(find(root, 'quick'), { note: 'x' });
    expect(painted('penciled-yellow-noted')).toEqual(['quick']);
  });
});

test('storage failures never break the UI', async () => {
  const onError = vi.fn();
  const fail = async () => Promise.reject(new Error('offline'));
  const { root, instance } = await setup({ storage: { load: fail, save: fail }, onError });
  await selectText(find(root, 'brown fox'));
  action('color-green')!.click();
  expect(painted('penciled-green')).toEqual(['brown fox']);
  action('note')!.click();
  field()!.value = 'Saved in memory';
  press('Enter', { ctrlKey: true });
  expect(instance.getAll()[0]?.note).toBe('Saved in memory');
  clickOn(find(root, 'brown'));
  expect(popover()?.querySelector('[data-penciled-note]')?.textContent).toBe('Saved in memory');
  expect(onError).toHaveBeenCalledTimes(1);
});

test('destroy() removes every UI node', async () => {
  const { root, instance } = await setup();
  await selectText(find(root, 'quick'));
  expect(popover()).not.toBeNull();
  instance.destroy();
  expect(document.querySelector('[data-penciled]')).toBeNull();
  instance.destroy();
});

describe('note preview on hover', () => {
  const tip = () => document.querySelector<HTMLElement>('[data-penciled-popover][role=tooltip]');
  const tipShown = () => !!tip() && !tip()!.hasAttribute('data-penciled-closing');
  const hover = async (target: Range | Element, wait_ = 400) => {
    const rect =
      target instanceof Range ? target.getClientRects()[0]! : target.getBoundingClientRect();
    const x = rect.left + 2;
    const y = rect.top + rect.height / 2;
    (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerType: 'mouse',
      }),
    );
    await wait(wait_);
  };

  test('is off by default', async () => {
    const { root, instance } = await setup();
    instance.create(find(root, 'quick'), { note: 'Hidden' });
    await hover(find(root, 'quick'));
    expect(tip()).toBeNull();
  });

  test('shows the note after a short rest, and hides when the mouse leaves', async () => {
    const { root, instance } = await setup({ notePreview: 'hover' });
    instance.create(find(root, 'quick'), { note: 'A <i>quick</i> note' });
    await hover(find(root, 'quick'), 100);
    expect(tip()).toBeNull();
    await wait(300);
    expect(tipShown()).toBe(true);
    expect(tip()!.textContent).toBe('A <i>quick</i> note');
    expect(tip()!.querySelector('i')).toBeNull();
    expect(shown()).toBe(false);
    // Polled: hiding waits a frame for hit-testing, then the grace period.
    await hover(find(root, 'lazy'), 0);
    await expect.poll(tipShown).toBe(false);
  });

  test('stays while the mouse is on it; Esc and clicks close it', async () => {
    const { root, instance } = await setup({ notePreview: 'hover' });
    instance.create(find(root, 'quick'), { note: 'Stay' });
    await hover(find(root, 'quick'));
    await hover(tip()!, 250);
    expect(tipShown()).toBe(true);
    press('Escape');
    expect(tipShown()).toBe(false);

    await hover(find(root, 'quick'));
    expect(tipShown()).toBe(true);
    clickOn(find(root, 'quick'));
    expect(shown()).toBe(true);
    expect(tipShown()).toBe(false);
  });

  test('ignores annotations without a note', async () => {
    const { root, instance } = await setup({ notePreview: 'hover' });
    instance.create(find(root, 'quick'));
    await hover(find(root, 'quick'));
    expect(tip()).toBeNull();
  });
});

describe('placement', () => {
  const HTML = `<div style="height: 200px"></div>${TEXT}<div style="height: 400px"></div>`;

  test('the toolbar can be placed below, aligned with the start of the text', async () => {
    const { root } = await setup({ placement: { toolbar: 'bottom-start' } }, HTML);
    const range = find(root, 'brown fox');
    await selectText(range);
    await wait(50);
    const pop = popover()!.getBoundingClientRect();
    const sel = range.getBoundingClientRect();
    expect(popover()!.dataset.penciledSide).toBe('bottom-start');
    expect(pop.top).toBeGreaterThanOrEqual(sel.bottom);
    expect(pop.left).toBeCloseTo(sel.left, 0);
  });

  test('the editor can be placed above', async () => {
    const { root } = await setup({ placement: { editor: 'top' } }, HTML);
    await selectText(find(root, 'brown fox'));
    await wait(50);
    expect(popover()!.dataset.penciledSide).toBe('top');
    action('note')!.click();
    await wait(50);
    expect(popover()!.dataset.penciledSide).toBe('top');
  });

  test('the editor defaults to below', async () => {
    const { root } = await setup({}, HTML);
    await selectText(find(root, 'brown fox'));
    action('note')!.click();
    await wait(50);
    expect(popover()!.dataset.penciledSide).toBe('bottom');
  });
});

test('icon-only actions sit beside the note', async () => {
  const { root, instance } = await setup({ readOnly: true, actions: ['copy'] });
  instance.create(find(root, 'quick'), { note: 'Read me' });
  clickOn(find(root, 'quick'));
  await wait(50);
  const note = popover()!.querySelector('[data-penciled-note]')!.getBoundingClientRect();
  const bar = toolbar()!.getBoundingClientRect();
  expect(toolbar()!.hasAttribute('data-penciled-inline')).toBe(true);
  expect(bar.left).toBeGreaterThanOrEqual(note.right);
  expect(bar.top).toBeCloseTo(note.top, -1);
});
