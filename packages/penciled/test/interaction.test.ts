import { afterEach, describe, expect, test, vi } from 'vitest';
import { segments } from '../src/engine/render.ts';
import type { AnnotateOptions, Annotation, SelectContext } from '../src/engine/types.ts';
import { annotate } from '../src/headless.ts';
import {
  cleanup,
  clickAt,
  clickOn,
  find,
  mount,
  painted,
  selectText,
  track,
  wait,
} from './helpers.ts';

afterEach(cleanup);

const TEXT = '<p style="font: 20px/1.5 monospace">The quick brown fox jumps over the lazy dog.</p>';

async function setup(options: AnnotateOptions = {}, html = TEXT) {
  const { root } = mount(html);
  document.body.append(
    Object.assign(document.createElement('p'), { textContent: 'Outside paragraph.' }),
  );
  const onSelect = vi.fn<(ctx: SelectContext | null) => void>();
  const instance = track(annotate(root, { storage: 'memory', onSelect, ...options }));
  await instance.ready;
  const last = () => onSelect.mock.lastCall?.[0];
  return { root, instance, onSelect, last };
}

describe('segments', () => {
  test('splits overlaps so the innermost span owns each piece', () => {
    const outer = { start: 0, end: 20 };
    const inner = { start: 5, end: 10 };
    const tail = { start: 15, end: 25 };
    expect(segments([outer, inner, tail])).toEqual([
      [0, 5, outer],
      [5, 10, inner],
      [10, 15, outer],
      [15, 25, tail],
    ]);
  });

  test('handles identical, adjacent and disjoint spans', () => {
    const a = { start: 0, end: 5 };
    const b = { start: 0, end: 5 };
    const c = { start: 5, end: 8 };
    const d = { start: 10, end: 12 };
    expect(segments([a, b, c, d])).toEqual([
      [0, 5, b],
      [5, 8, c],
      [10, 12, d],
    ]);
  });
});

describe('overlap rendering', () => {
  test('paints the innermost annotation on top, with no doubled ranges', async () => {
    const { root, instance } = await setup();
    instance.create(find(root, 'quick brown fox jumps'), { color: 'yellow' });
    instance.create(find(root, 'brown fox'), { color: 'blue' });
    expect(painted('penciled-yellow')).toEqual(['quick ', ' jumps']);
    expect(painted('penciled-blue')).toEqual(['brown fox']);
  });
});

describe('hit-testing', () => {
  test('clicking a highlight selects its annotation; overlaps open the innermost', async () => {
    const { root, instance, last } = await setup();
    const outer = instance.create(find(root, 'quick brown fox jumps'))!;
    const inner = instance.create(find(root, 'brown fox'), { color: 'blue' })!;

    clickOn(find(root, 'quick'));
    expect(last()?.annotation?.id).toBe(outer.id);
    expect(last()).toMatchObject({ text: 'quick brown fox jumps', editable: true });
    expect(last()?.range.toString()).toBe('quick brown fox jumps');
    expect(painted('penciled-active')).toEqual(['quick brown fox jumps']);

    clickOn(find(root, 'own fox'));
    expect(last()?.annotation?.id).toBe(inner.id);
    expect(painted('penciled-active')).toEqual(['brown fox']);
  });

  test('clicking plain text or outside dismisses', async () => {
    const { root, instance, last, onSelect } = await setup();
    instance.create(find(root, 'quick'));
    clickOn(find(root, 'quick'));
    expect(last()?.annotation).toBeDefined();
    clickOn(find(root, 'lazy'));
    expect(last()).toBeNull();
    expect(CSS.highlights.has('penciled-active')).toBe(false);
    clickOn(find(root, 'quick'));
    clickOn(find(document.body, 'Outside'));
    expect(last()).toBeNull();
    // Repeated dismissals are not re-reported.
    const calls = onSelect.mock.calls.length;
    clickOn(find(root, 'lazy'));
    expect(onSelect.mock.calls.length).toBe(calls);
  });

  test('works in right-to-left and mixed-direction text', async () => {
    const { root, instance, last } = await setup(
      {},
      '<p dir="rtl" style="font: 20px/1.5 serif">שלום עולם, זהו טקסט with English לדוגמה.</p>',
    );
    const hebrew = instance.create(find(root, 'זהו טקסט'))!;
    const english = instance.create(find(root, 'English'))!;
    expect(painted('penciled-yellow').sort()).toEqual(['English', 'זהו טקסט']);
    clickOn(find(root, 'טקסט'));
    expect(last()?.annotation?.id).toBe(hebrew.id);
    clickOn(find(root, 'English'));
    expect(last()?.annotation?.id).toBe(english.id);
    clickOn(find(root, 'שלום'));
    expect(last()).toBeNull();
  });

  test('a click just past the end of a highlight does not hit it', async () => {
    const { root, instance, last } = await setup();
    instance.create(find(root, 'quick'));
    const after = find(root, ' brown');
    const rect = after.getClientRects()[0]!;
    clickAt(rect.left + rect.width / 12, rect.top + rect.height / 2);
    expect(last() ?? null).toBeNull();
  });

  test('clicks inside penciled UI are ignored', async () => {
    const { root, instance, last } = await setup();
    instance.create(find(root, 'quick'));
    clickOn(find(root, 'quick'));
    const ui = document.createElement('div');
    ui.setAttribute('data-penciled', '');
    ui.textContent = 'Toolbar';
    document.body.append(ui);
    clickOn(find(ui, 'Toolbar'));
    expect(last()?.annotation).toBeDefined();
  });
});

describe('selection', () => {
  test('a settled selection in the container is reported, trimmed', async () => {
    const { root, last } = await setup();
    await selectText(find(root, ' brown fox '));
    expect(last()).toMatchObject({ text: 'brown fox', editable: true });
    expect(last()?.annotation).toBeUndefined();
    expect(last()?.range.toString()).toBe('brown fox');
  });

  test('selecting exactly an annotation reports that annotation', async () => {
    const { root, instance, last } = await setup();
    const a = instance.create(find(root, 'lazy dog'))!;
    await selectText(find(root, 'lazy dog'));
    expect(last()?.annotation?.id).toBe(a.id);
    expect(painted('penciled-active')).toEqual(['lazy dog']);
  });

  test('collapsing the selection dismisses it', async () => {
    const { root, last } = await setup();
    await selectText(find(root, 'brown'));
    expect(last()?.text).toBe('brown');
    await selectText(null);
    expect(last()).toBeNull();
  });

  test('selections outside the container, or crossing its edge, are not reported', async () => {
    const { root, onSelect } = await setup();
    await selectText(find(document.body, 'Outside'));
    const crossing = document.createRange();
    crossing.setStart(find(root, 'lazy').startContainer, 0);
    crossing.setEnd(find(document.body, 'Outside').endContainer, 3);
    await selectText(crossing);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('selections in editable content are not reported', async () => {
    const { root, onSelect, last } = await setup(
      {},
      `${TEXT}<div contenteditable>An editable draft.</div>`,
    );
    await selectText(find(root, 'editable draft'));
    expect(onSelect).not.toHaveBeenCalled();
    // Partly in the editor.
    const crossing = document.createRange();
    crossing.setStart(find(root, 'lazy').startContainer, 0);
    crossing.setEnd(find(root, 'editable').endContainer, 3);
    await selectText(crossing);
    expect(onSelect).not.toHaveBeenCalled();
    await selectText(find(root, 'brown'));
    expect(last()?.text).toBe('brown');
  });

  test('pointer selections are reported on pointerup, not while dragging', async () => {
    const { root, onSelect, last } = await setup();
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    getSelection()!.addRange(find(root, 'brown'));
    await wait(250);
    expect(onSelect).not.toHaveBeenCalled();
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(last()?.text).toBe('brown');
  });
});

describe('readOnly and editable', () => {
  test('readOnly ignores new selections but still opens annotations', async () => {
    const { root, instance, onSelect, last } = await setup({ readOnly: true });
    // The programmatic API stays available to the developer.
    const a = instance.create(find(root, 'quick'))!;
    await selectText(find(root, 'lazy'));
    expect(onSelect).not.toHaveBeenCalled();
    await selectText(null);
    clickOn(find(root, 'quick'));
    expect(last()).toMatchObject({ annotation: { id: a.id }, editable: false });
  });

  test('editable: false annotations are reported as not editable', async () => {
    const { root, instance, last } = await setup();
    instance.create(find(root, 'quick'), { editable: false });
    instance.create(find(root, 'lazy'));
    clickOn(find(root, 'quick'));
    expect(last()?.editable).toBe(false);
    clickOn(find(root, 'lazy'));
    expect(last()?.editable).toBe(true);
  });
});

describe('focus', () => {
  test('scrolls to the annotation, marks it active and reports it', async () => {
    const { root, instance, last } = await setup({}, `<div style="height: 3000px"></div>${TEXT}`);
    const a = instance.create(find(root, 'lazy dog'))!;
    window.scrollTo(0, 0);
    instance.focus(a.id);
    expect(last()?.annotation?.id).toBe(a.id);
    expect(painted('penciled-active')).toEqual(['lazy dog']);
    // Smooth scrolling takes longer on a busy machine.
    await expect
      .poll(() => {
        const rect = instance.getRange(a.id)!.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      })
      .toBe(true);
  });

  test('ignores orphans and unknown ids', async () => {
    const { instance, onSelect } = await setup();
    instance.focus('nope');
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('removing the active annotation dismisses it', async () => {
    const { root, instance, last } = await setup();
    const a = instance.create(find(root, 'quick'))!;
    instance.focus(a.id);
    instance.remove(a.id);
    expect(last()).toBeNull();
    expect(CSS.highlights.has('penciled-active')).toBe(false);
  });
});

describe('re-anchoring on content changes', () => {
  test('follows text when content is inserted before it', async () => {
    const { root, instance } = await setup();
    const a = instance.create(find(root, 'lazy dog'))!;
    root.prepend(Object.assign(document.createElement('p'), { textContent: 'New intro. ' }));
    await wait(200);
    expect(instance.getRange(a.id)?.toString()).toBe('lazy dog');
    expect(painted('penciled-yellow')).toEqual(['lazy dog']);
  });

  test('orphans an annotation whose text is deleted', async () => {
    const onOrphan = vi.fn();
    const { root, instance } = await setup({ onOrphan });
    const a = instance.create(find(root, 'lazy dog'))!;
    find(root, 'lazy dog').deleteContents();
    await wait(200);
    expect(onOrphan).toHaveBeenCalledWith(expect.objectContaining({ id: a.id }));
    expect(instance.getRange(a.id)).toBeNull();
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
  });

  test('re-anchors an orphan when its text comes back', async () => {
    const { root, instance } = await setup();
    const p = root.querySelector('p')!;
    const a = instance.create(find(root, 'lazy dog'))!;
    const original = p.textContent;
    p.textContent = 'Loading…';
    await wait(200);
    expect(instance.getRange(a.id)).toBeNull();
    p.textContent = original;
    await wait(200);
    expect(instance.getRange(a.id)?.toString()).toBe('lazy dog');
  });

  test('reads are consistent even before the debounced refresh runs', async () => {
    const { root, instance } = await setup();
    const a = instance.create(find(root, 'lazy dog'))!;
    root.prepend(Object.assign(document.createElement('p'), { textContent: 'Intro. ' }));
    await Promise.resolve(); // the observer has fired, the debounce has not
    expect(instance.getRange(a.id)?.toString()).toBe('lazy dog');
  });

  test('ignores changes inside penciled UI nodes', async () => {
    const onOrphan = vi.fn();
    const { root, instance } = await setup({ onOrphan });
    instance.create(find(root, 'lazy dog'));
    const before = [...CSS.highlights.get('penciled-yellow')!];
    const ui = document.createElement('span');
    ui.setAttribute('data-penciled', '');
    root.querySelector('p')!.append(ui);
    ui.textContent = 'lazy dog lazy dog';
    await wait(200);
    // A refresh would have repainted with new Range objects.
    expect([...CSS.highlights.get('penciled-yellow')!]).toEqual(before);
    expect(onOrphan).not.toHaveBeenCalled();
  });

  test('follows text that a framework patches in place or re-renders', async () => {
    const { root, instance } = await setup({}, `<p>Count: 1</p>${TEXT}`);
    const a = instance.create(find(root, 'lazy dog'))!;
    const counter = root.querySelector('p')!;
    // Patched in place, as Vue, Preact or Svelte update a text binding.
    (counter.firstChild as Text).data = 'Count: 1000';
    await wait(200);
    expect(instance.getRange(a.id)?.toString()).toBe('lazy dog');
    // Replaced by new, equal nodes, as a keyed list or a remount does.
    const p = root.querySelectorAll('p')[1]!;
    p.replaceWith(p.cloneNode(true));
    await wait(200);
    expect(instance.getRange(a.id)?.toString()).toBe('lazy dog');
    expect(painted('penciled-yellow')).toEqual(['lazy dog']);
  });

  test('anchors annotations in sections that load later', async () => {
    const onOrphan = vi.fn();
    const stored = { quote: 'later section', prefix: 'A ', suffix: ' arrives.', start: 2, end: 15 };
    const { root, instance } = await setup({
      onOrphan,
      storage: { load: async () => [stored as Annotation], save: async () => {} },
    });
    const [a] = instance.getAll() as [Annotation];
    expect(onOrphan).toHaveBeenCalledTimes(1);
    root.append(
      Object.assign(document.createElement('p'), { textContent: 'A later section arrives.' }),
    );
    await wait(200);
    expect(instance.getRange(a.id)?.toString()).toBe('later section');
    expect(painted('penciled-yellow')).toEqual(['later section']);
  });

  test('pages without annotations build no index until text is selected', async () => {
    const { root, instance, last } = await setup();
    const brown = find(root, 'brown');
    const walk = vi.spyOn(document, 'createTreeWalker');
    root.append(Object.assign(document.createElement('p'), { textContent: 'More.' }));
    await wait(200);
    clickOn(brown);
    expect(walk).not.toHaveBeenCalled();
    await selectText(brown);
    expect(last()?.text).toBe('brown');
    expect(walk).toHaveBeenCalledTimes(1);
    // The first annotation wakes the observer up.
    const a = instance.create(brown)!;
    root.prepend(Object.assign(document.createElement('p'), { textContent: 'Intro. ' }));
    await wait(200);
    expect(painted('penciled-yellow')).toEqual(['brown']);
    expect(instance.getRange(a.id)?.toString()).toBe('brown');
  });

  test('keeps up with content that never stops changing', async () => {
    const { root, instance } = await setup({}, `<p>Price: 0</p>${TEXT}`);
    instance.create(find(root, 'lazy dog'));
    const ranges = () => [...CSS.highlights.get('penciled-yellow')!];
    const [before] = ranges();
    // A ticker that changes faster than re-anchoring is batched.
    const price = root.querySelector('p')!.firstChild as Text;
    const ticker = setInterval(() => {
      price.data = `Price: ${Math.random()}`;
    }, 30);
    await wait(400);
    clearInterval(ticker);
    expect(ranges()[0]).not.toBe(before);
    expect(painted('penciled-yellow')).toEqual(['lazy dog']);
  });

  test('hidden tabs re-anchor once they are shown again', async () => {
    const { root, instance } = await setup();
    instance.create(find(root, 'lazy dog'));
    const ranges = () => [...CSS.highlights.get('penciled-yellow')!];
    const [before] = ranges();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    root.prepend(Object.assign(document.createElement('p'), { textContent: 'Intro. ' }));
    await wait(200);
    // A refresh would have repainted with new Range objects.
    expect(ranges()[0]).toBe(before);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(200);
    expect(ranges()[0]).not.toBe(before);
    expect(painted('penciled-yellow')).toEqual(['lazy dog']);
  });

  test('slow refreshes are spaced further apart', async () => {
    const { root, instance } = await setup();
    instance.create(find(root, 'lazy dog'));
    // Every refresh appears to take 50ms, so the next waits 500ms.
    let t = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => (t += 25));
    instance.refresh();
    now.mockRestore();
    const ranges = () => [...CSS.highlights.get('penciled-yellow')!];
    const [before] = ranges();
    root.prepend(Object.assign(document.createElement('p'), { textContent: 'Intro. ' }));
    await wait(250);
    expect(ranges()[0]).toBe(before);
    await wait(500);
    expect(ranges()[0]).not.toBe(before);
  });

  test('with observe: false, changes apply on refresh()', async () => {
    const { root, instance } = await setup({ observe: false });
    const a = instance.create(find(root, 'lazy dog'))!;
    const p = root.querySelector('p')!;
    p.textContent = 'Nothing to see.';
    await wait(200);
    // Not re-anchored yet: the old range collapsed along with the text it covered.
    expect(painted('penciled-yellow')).toEqual(['']);
    instance.refresh();
    expect(instance.getRange(a.id)).toBeNull();
  });
});

describe('dev warnings', () => {
  test('recommends an explicit documentId, once per page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A fresh module instance, so earlier tests haven't used up the warning.
    const fresh: typeof import('../src/engine/annotate.ts') = await import(
      // @ts-expect-error: query strings are a Vite feature
      '../src/engine/annotate.ts?fresh'
    );
    track(fresh.annotate(mount('<p>a</p>').root, { storage: 'memory' }));
    track(fresh.annotate(mount('<p>b</p>').root, { storage: 'memory' }));
    track(fresh.annotate(mount('<p>c</p>').root, { storage: 'memory', documentId: 'x' }));
    expect(warn.mock.calls.filter(([m]) => /documentId/.test(m))).toHaveLength(1);
  });
});
