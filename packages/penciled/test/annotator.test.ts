import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AnnotateOptions } from '../src/engine/types.ts';
import { annotate } from '../src/headless.ts';
import { cleanup, find, mount, painted, track } from './helpers.ts';

afterEach(cleanup);

const TEXT =
  '<p>The quick brown fox jumps over the lazy dog. Pack my box with five dozen jugs.</p>';

function setup(options: AnnotateOptions = {}, html = TEXT) {
  const { root } = mount(html);
  const instance = track(annotate(root, { storage: 'memory', ...options }));
  return { root, instance };
}

describe('create / read', () => {
  test('creates an annotation from a range and paints it', async () => {
    const { root, instance } = setup();
    await instance.ready;
    const a = instance.create(find(root, 'quick brown'), { meta: { user: 7, tags: ['x'] } })!;
    expect(a).toMatchObject({
      version: 1,
      quote: 'quick brown',
      prefix: 'The ',
      suffix: ' fox jumps over the lazy dog. Pa',
      start: 4,
      end: 15,
      color: 'yellow',
      meta: { user: 7, tags: ['x'] },
    });
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.createdAt).toBe(a.updatedAt);
    expect(instance.get(a.id)).toEqual(a);
    expect(instance.getAll()).toEqual([a]);
    expect(instance.getRange(a.id)?.toString()).toBe('quick brown');
    expect(painted('penciled-yellow')).toEqual(['quick brown']);
  });

  test('returns copies, so callers cannot mutate the store', async () => {
    const { root, instance } = setup();
    const a = instance.create(find(root, 'quick'))!;
    a.color = 'pink';
    instance.getAll()[0]!.note = 'sneaky';
    expect(instance.get(a.id)).toMatchObject({ color: 'yellow' });
    expect(instance.get(a.id)?.note).toBeUndefined();
  });

  test('uses the given color and note', () => {
    const { root, instance } = setup();
    const a = instance.create(find(root, 'lazy dog'), { color: 'blue', note: 'Hi' })!;
    expect(a).toMatchObject({ color: 'blue', note: 'Hi' });
    expect(painted('penciled-blue')).toEqual(['lazy dog']);
  });

  test('selecting exactly an existing annotation returns it instead of duplicating', () => {
    const onCreate = vi.fn();
    const { root, instance } = setup({ onCreate });
    const a = instance.create(find(root, 'quick brown'))!;
    // Same text, with surrounding whitespace that gets trimmed.
    expect(instance.create(find(root, ' quick brown '))).toEqual(a);
    expect(instance.getAll()).toHaveLength(1);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  test('ignores ranges without text, or outside the container', () => {
    const { root, instance } = setup({}, '<p>one   two</p>');
    const text = root.querySelector('p')!.firstChild!;
    const blank = document.createRange();
    blank.setStart(text, 3);
    blank.setEnd(text, 6);
    expect(instance.create(blank)).toBeUndefined();
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.append(outside);
    expect(instance.create(find(outside, 'elsewhere'))).toBeUndefined();
  });

  test('lists annotations in document order', () => {
    const { root, instance } = setup();
    instance.create(find(root, 'lazy'));
    instance.create(find(root, 'quick'));
    instance.create(find(root, 'jugs'));
    expect(instance.getAll().map((a) => a.quote)).toEqual(['quick', 'lazy', 'jugs']);
  });
});

describe('update / remove / clear', () => {
  test('updates color, note, editable and meta', () => {
    const onUpdate = vi.fn();
    const { root, instance } = setup({ onUpdate });
    const a = instance.create(find(root, 'quick'))!;
    const b = instance.update(a.id, {
      color: 'green',
      note: 'A note',
      editable: false,
      meta: { k: 1 },
    })!;
    expect(b).toMatchObject({ color: 'green', note: 'A note', editable: false, meta: { k: 1 } });
    expect(b.quote).toBe('quick');
    expect(onUpdate).toHaveBeenCalledWith(b);
    expect(painted('penciled-green')).toEqual(['quick']);
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
  });

  test('a null or empty note removes it', () => {
    const { root, instance } = setup();
    const a = instance.create(find(root, 'quick'), { note: 'x' })!;
    expect('note' in instance.update(a.id, { note: null })!).toBe(false);
    instance.update(a.id, { note: 'y' });
    expect('note' in instance.update(a.id, { note: '' })!).toBe(false);
  });

  test('update of an unknown id returns undefined', () => {
    const { instance } = setup();
    expect(instance.update('nope', { color: 'blue' })).toBeUndefined();
  });

  test('removes one annotation or all of them', () => {
    const onDelete = vi.fn();
    const { root, instance } = setup({ onDelete });
    const a = instance.create(find(root, 'quick'))!;
    const b = instance.create(find(root, 'lazy'))!;
    instance.remove(a.id);
    expect(onDelete).toHaveBeenCalledWith(a);
    expect(instance.getAll()).toEqual([b]);
    expect(painted('penciled-yellow')).toEqual(['lazy']);
    instance.clear();
    expect(instance.getAll()).toEqual([]);
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });
});

describe('events', () => {
  test('on() returns an unsubscribe function', () => {
    const { root, instance } = setup();
    const fn = vi.fn();
    const off = instance.on('create', fn);
    instance.create(find(root, 'quick'));
    off();
    instance.create(find(root, 'lazy'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('a throwing listener does not break others or the engine', () => {
    const { root, instance } = setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = vi.fn();
    instance.on('create', () => {
      throw new Error('boom');
    });
    instance.on('create', fn);
    expect(instance.create(find(root, 'quick'))).toBeDefined();
    expect(fn).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  test('load fires once stored annotations are anchored', async () => {
    const onLoad = vi.fn();
    const storage = {
      load: async () => [
        {
          version: 1 as const,
          id: 'a',
          quote: 'lazy dog',
          prefix: 'over the ',
          suffix: '. Pack',
          start: 35,
          end: 43,
          color: 'pink',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      save: async () => {},
    };
    const { instance } = setup({ storage, onLoad });
    await instance.ready;
    expect(onLoad).toHaveBeenCalledWith([expect.objectContaining({ id: 'a', quote: 'lazy dog' })]);
    expect(painted('penciled-pink')).toEqual(['lazy dog']);
  });
});

describe('colors', () => {
  test('unknown color names render with defaultColor but are stored as-is', async () => {
    const { root, instance } = setup({ colors: ['red', 'teal'], defaultColor: 'teal' });
    const a = instance.create(find(root, 'quick'), { color: 'yellow' })!;
    expect(a.color).toBe('yellow');
    expect(painted('penciled-teal')).toEqual(['quick']);
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
    expect(instance.create(find(root, 'lazy'))!.color).toBe('teal');
  });

  test('defaultColor falls back to the first configured color', () => {
    const { root, instance } = setup({ colors: ['red'] });
    expect(instance.create(find(root, 'quick'))!.color).toBe('red');
  });

  test('noteIndicator paints annotations with notes in -noted registries', () => {
    const { root, instance } = setup({ noteIndicator: 'underline' });
    instance.create(find(root, 'quick'), { note: 'n' });
    instance.create(find(root, 'lazy'));
    expect(painted('penciled-yellow-noted')).toEqual(['quick']);
    expect(painted('penciled-yellow')).toEqual(['lazy']);
  });

  test('without noteIndicator, notes do not change the registry', () => {
    const { root, instance } = setup();
    instance.create(find(root, 'quick'), { note: 'n' });
    expect(painted('penciled-yellow')).toEqual(['quick']);
    expect(CSS.highlights.has('penciled-yellow-noted')).toBe(false);
  });
});

describe('orphans', () => {
  test('annotations that cannot be placed are kept, reported and not painted', async () => {
    const onOrphan = vi.fn();
    const stored = {
      version: 1 as const,
      id: 'gone',
      quote: 'a sentence that is not here',
      prefix: '',
      suffix: '',
      start: 0,
      end: 27,
      color: 'yellow',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const { instance } = setup({
      onOrphan,
      storage: { load: async () => [stored], save: async () => {} },
    });
    await instance.ready;
    expect(onOrphan).toHaveBeenCalledWith(stored);
    expect(instance.getAll()).toEqual([stored]);
    expect(instance.getRange('gone')).toBeNull();
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
    // Still editable and removable through the API.
    expect(instance.update('gone', { note: 'x' })?.note).toBe('x');
    instance.remove('gone');
    expect(instance.getAll()).toEqual([]);
  });
});

describe('documentId', () => {
  test('defaults to the pathname, then the container id or an index', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = mount('<p>a</p>').root;
    const b = mount('<p>b</p>').root;
    const c = mount('<p>c</p>').root;
    c.id = 'notes';
    const path = location.pathname;
    expect(track(annotate(a, { storage: 'memory' })).documentId).toBe(path);
    expect(track(annotate(b, { storage: 'memory' })).documentId).toBe(`${path}#1`);
    expect(track(annotate(c, { storage: 'memory' })).documentId).toBe(`${path}#notes`);
    expect(track(annotate(mount('<p>d</p>').root, { documentId: 'doc-1' })).documentId).toBe(
      'doc-1',
    );
    warn.mockRestore();
  });

  test('ids are released on destroy', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = mount('<p>a</p>').root;
    annotate(root, { storage: 'memory' }).destroy();
    expect(track(annotate(root, { storage: 'memory' })).documentId).toBe(location.pathname);
  });

  test('accepts a selector and throws when nothing matches', () => {
    mount('<article id="post"><p>hello</p></article>');
    expect(track(annotate('#post', { storage: 'memory' })).container.id).toBe('post');
    expect(() => annotate('#missing')).toThrow(/No element matches "#missing"/);
  });
});

describe('feature detection', () => {
  test('without CSS.highlights it warns and does nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('CSS', {});
    try {
      const { root } = mount(TEXT);
      const instance = annotate(root);
      await instance.ready;
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Custom Highlight API/));
      expect(instance.create(find(root, 'quick'))).toBeUndefined();
      expect(instance.getAll()).toEqual([]);
      expect(instance.export().annotations).toEqual([]);
      expect(typeof instance.on('create', () => {})).toBe('function');
      instance.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('destroy', () => {
  test('removes highlights and listeners, and flushes pending writes', async () => {
    const save = vi.fn(async () => {});
    const onSelect = vi.fn();
    const { root } = mount(TEXT);
    const instance = annotate(root, { storage: { load: async () => [], save }, onSelect });
    await instance.ready;
    instance.create(find(root, 'quick'));
    instance.destroy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
    getSelection()!.addRange(find(root, 'lazy'));
    await new Promise((r) => setTimeout(r, 250));
    expect(onSelect).not.toHaveBeenCalled();
    instance.destroy(); // idempotent
  });

  test('leaves nothing behind, even when used afterwards', async () => {
    const { root } = mount(TEXT);
    const instance = annotate(root, { storage: 'memory' });
    await instance.ready;
    const a = instance.create(find(root, 'quick'))!;
    instance.focus(a.id);
    // A change the debounced refresh hasn't applied yet.
    root.querySelector('p')!.prepend('New ');
    instance.destroy();
    instance.getRange(a.id);
    instance.annotationAt(0, 0);
    instance.focus(a.id);
    instance.create(find(root, 'lazy'));
    instance.refresh();
    await new Promise((r) => setTimeout(r, 250));
    expect([...CSS.highlights.keys()]).toEqual([]);
  });
});

describe('multiple containers', () => {
  test('instances share registries without disturbing each other', () => {
    const one = setup();
    const two = setup({}, '<p>Another container with quick text.</p>');
    one.instance.create(find(one.root, 'brown'));
    two.instance.create(find(two.root, 'Another'));
    expect(painted('penciled-yellow').sort()).toEqual(['Another', 'brown']);
    one.instance.destroy();
    expect(painted('penciled-yellow')).toEqual(['Another']);
    two.instance.clear();
    expect(CSS.highlights.has('penciled-yellow')).toBe(false);
  });
});
