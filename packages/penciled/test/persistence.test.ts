import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AnnotateOptions, Annotation, AnnotationStorage } from '../src/engine/types.ts';
import { annotate, fromW3C, toW3C } from '../src/headless.ts';
import { cleanup, find, mount, painted, track, wait } from './helpers.ts';

afterEach(cleanup);

const TEXT =
  '<p>The quick brown fox jumps over the lazy dog. Pack my box with five dozen jugs.</p>';

async function setup(options: AnnotateOptions = {}, html = TEXT) {
  const { root } = mount(html);
  const instance = track(annotate(root, { documentId: 'doc', ...options }));
  await instance.ready;
  return { root, instance };
}

/** A storage adapter whose calls are recorded. */
function spyStorage(initial: Annotation[] = [], granular = false) {
  const storage = {
    load: vi.fn(async (_: string) => initial),
    save: vi.fn(async (_: string, __: Annotation[]) => {}),
    ...(granular && {
      create: vi.fn(async (_: string, __: Annotation) => {}),
      update: vi.fn(async (_: string, __: Annotation) => {}),
      delete: vi.fn(async (_: string, __: string) => {}),
    }),
  };
  return storage as typeof storage & Required<AnnotationStorage>;
}

describe('localStorage', () => {
  test('persists and restores across instances', async () => {
    const first = await setup({ saveDelay: 0 });
    const a = first.instance.create(find(first.root, 'lazy dog'), {
      note: 'Good boy',
      color: 'pink',
    })!;
    expect(JSON.parse(localStorage.getItem('penciled:doc')!)).toEqual({
      version: 1,
      annotations: [a],
    });
    first.instance.destroy();
    document.body.replaceChildren();

    const onLoad = vi.fn();
    const second = await setup({ onLoad });
    expect(second.instance.getAll()).toEqual([a]);
    expect(onLoad).toHaveBeenCalledWith([a]);
    expect(painted('penciled-pink')).toEqual(['lazy dog']);
  });

  test('scopes data by documentId', async () => {
    const one = await setup({ saveDelay: 0 });
    one.instance.create(find(one.root, 'quick'));
    const two = await setup({ documentId: 'other' });
    expect(two.instance.getAll()).toEqual([]);
  });

  test('corrupt data reports an error, starts empty and is replaced on the next save', async () => {
    localStorage.setItem('penciled:doc', '{not json');
    const onError = vi.fn();
    const { root, instance } = await setup({ onError, saveDelay: 0 });
    expect(onError).toHaveBeenCalledWith(expect.any(SyntaxError));
    const a = instance.create(find(root, 'quick'));
    expect(JSON.parse(localStorage.getItem('penciled:doc')!).annotations).toEqual([a]);
  });

  test('a full quota is reported and never breaks the in-memory state', async () => {
    const onError = vi.fn();
    const { root, instance } = await setup({ onError, saveDelay: 0 });
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quota;
    });
    const a = instance.create(find(root, 'quick'), { note: 'Kept' })!;
    await wait(0);
    expect(onError).toHaveBeenCalledWith(quota);
    expect(instance.update(a.id, { color: 'green' })?.color).toBe('green');
    expect(painted('penciled-green')).toEqual(['quick']);
    vi.mocked(Storage.prototype.setItem).mockRestore();
  });

  test('skips stored items that are not version-1 annotations', async () => {
    localStorage.setItem(
      'penciled:doc',
      JSON.stringify({ version: 1, annotations: [{ junk: true }, { version: 2, quote: 'quick' }] }),
    );
    const { instance } = await setup();
    expect(instance.getAll()).toEqual([]);
  });
});

describe('saving', () => {
  test('debounces writes by saveDelay into one save()', async () => {
    const storage = spyStorage();
    const { root, instance } = await setup({ storage, saveDelay: 50 });
    const a = instance.create(find(root, 'quick'))!;
    instance.update(a.id, { color: 'blue' });
    instance.create(find(root, 'lazy'));
    expect(storage.save).not.toHaveBeenCalled();
    await wait(100);
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledWith('doc', instance.getAll());
  });

  test('saveDelay: 0 saves immediately', async () => {
    const storage = spyStorage();
    const { root, instance } = await setup({ storage, saveDelay: 0 });
    instance.create(find(root, 'quick'));
    expect(storage.save).toHaveBeenCalledTimes(1);
  });

  test('flushes pending writes on pagehide', async () => {
    const storage = spyStorage();
    const { root, instance } = await setup({ storage, saveDelay: 10_000 });
    instance.create(find(root, 'quick'));
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    expect(storage.save).toHaveBeenCalledTimes(1);
  });

  test('uses granular methods when present, coalescing per annotation', async () => {
    const existing = {
      version: 1 as const,
      id: 'old',
      quote: 'jugs',
      prefix: 'five dozen ',
      suffix: '.',
      start: 75,
      end: 79,
      color: 'yellow',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const storage = spyStorage([existing], true);
    const { root, instance } = await setup({ storage, saveDelay: 50 });
    const a = instance.create(find(root, 'quick'))!;
    instance.update(a.id, { note: 'n' }); // create + update → one create
    const b = instance.create(find(root, 'lazy'))!;
    instance.remove(b.id); // create + delete → nothing
    instance.update('old', { color: 'blue' });
    instance.update('old', { color: 'green' }); // update + update → one update
    await wait(100);
    expect(storage.create).toHaveBeenCalledTimes(1);
    expect(storage.create).toHaveBeenCalledWith('doc', instance.get(a.id));
    expect(storage.update).toHaveBeenCalledTimes(1);
    expect(storage.update).toHaveBeenCalledWith(
      'doc',
      expect.objectContaining({ id: 'old', color: 'green' }),
    );
    expect(storage.delete).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();

    instance.remove('old');
    await wait(100);
    expect(storage.delete).toHaveBeenCalledWith('doc', 'old');
  });

  test('falls back to save() for operations without a granular method', async () => {
    const { delete: _, ...storage } = spyStorage([], true);
    const { root, instance } = await setup({ storage, saveDelay: 0 });
    const a = instance.create(find(root, 'quick'))!;
    expect(storage.create).toHaveBeenCalledTimes(1);
    instance.remove(a.id);
    expect(storage.save).toHaveBeenCalledWith('doc', []);
  });

  test('failures go to onError and never break the in-memory state', async () => {
    const onError = vi.fn();
    const failure = new Error('offline');
    const storage = { load: async () => [], save: async () => Promise.reject(failure) };
    const { root, instance } = await setup({ storage, saveDelay: 0, onError });
    const a = instance.create(find(root, 'quick'));
    await wait(0);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(instance.getAll()).toEqual([a]);
    expect(painted('penciled-yellow')).toEqual(['quick']);
  });

  test('synchronous throws from an adapter are caught too', async () => {
    const onError = vi.fn();
    const storage = {
      load: async () => [],
      save: () => {
        throw new Error('sync');
      },
    } as unknown as AnnotationStorage;
    const { root, instance } = await setup({ storage, saveDelay: 0, onError });
    expect(instance.create(find(root, 'quick'))).toBeDefined();
    expect(onError).toHaveBeenCalled();
  });

  test('after a failed load nothing is written, so stored data is never overwritten', async () => {
    const onError = vi.fn();
    const failure = new Error('offline');
    const storage = { ...spyStorage([], true), load: vi.fn(async () => Promise.reject(failure)) };
    const { root, instance } = await setup({ storage, saveDelay: 0, onError });
    expect(onError).toHaveBeenCalledWith(failure);
    const a = instance.create(find(root, 'quick'))!;
    instance.update(a.id, { note: 'Still works' });
    instance.remove(a.id);
    instance.create(find(root, 'lazy'));
    instance.destroy();
    for (const method of ['save', 'create', 'update', 'delete'] as const) {
      expect(storage[method]).not.toHaveBeenCalled();
    }
  });

  test('without onError, failures are logged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = { load: async () => Promise.reject(new Error('down')), save: async () => {} };
    await setup({ storage });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'down' }));
  });

  test('writes wait for the initial load, so stored data is never overwritten', async () => {
    let resolve!: (a: Annotation[]) => void;
    const stored = {
      version: 1 as const,
      id: 'stored',
      quote: 'jugs',
      prefix: '',
      suffix: '',
      start: 75,
      end: 79,
      color: 'yellow',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const save = vi.fn(async () => {});
    const { root } = mount(TEXT);
    const instance = track(
      annotate(root, {
        documentId: 'doc',
        saveDelay: 0,
        storage: { load: () => new Promise((r) => (resolve = r)), save },
      }),
    );
    instance.create(find(root, 'quick'));
    expect(save).not.toHaveBeenCalled();
    resolve([stored]);
    await instance.ready;
    expect(save).toHaveBeenCalledTimes(1);
    expect((save.mock.calls[0] as unknown[])[1]).toEqual([
      expect.objectContaining({ quote: 'quick' }),
      expect.objectContaining({ id: 'stored' }),
    ]);
  });
});

describe('export / import', () => {
  test('export() returns version, documentId and annotations', async () => {
    const { root, instance } = await setup({ storage: 'memory' });
    const a = instance.create(find(root, 'quick'))!;
    expect(instance.export()).toEqual({ version: 1, documentId: 'doc', annotations: [a] });
  });

  test('import merges by id (incoming wins) and re-anchors', async () => {
    const source = await setup({ storage: 'memory', documentId: 'src' });
    const a = source.instance.create(find(source.root, 'quick'))!;
    const b = source.instance.create(find(source.root, 'lazy'))!;
    const data = source.instance.export();

    const onCreate = vi.fn();
    const onUpdate = vi.fn();
    const target = await setup(
      { storage: 'memory', onCreate, onUpdate },
      `<h1>Inserted heading</h1>${TEXT}`,
    );
    const mine = target.instance.create(find(target.root, 'jugs'))!;
    target.instance.import([{ ...a, color: 'blue' }]);
    target.instance.import(data);
    expect(onCreate).toHaveBeenCalledTimes(3); // mine, then a, then b
    expect(onUpdate).toHaveBeenCalledTimes(1); // a again
    expect(target.instance.getAll().map((x) => x.id)).toEqual([a.id, b.id, mine.id]);
    expect(target.instance.get(a.id)?.color).toBe('yellow');
    expect(target.instance.getRange(b.id)?.toString()).toBe('lazy');
  });

  test("import with mode: 'replace' removes everything else", async () => {
    const onDelete = vi.fn();
    const { root, instance } = await setup({ storage: 'memory', onDelete });
    const a = instance.create(find(root, 'quick'))!;
    const b = instance.create(find(root, 'lazy'))!;
    instance.import({ version: 1, documentId: 'doc', annotations: [b] }, { mode: 'replace' });
    expect(onDelete).toHaveBeenCalledWith(a);
    expect(instance.getAll()).toEqual([b]);
  });

  test('imported annotations that do not fit the content become orphans', async () => {
    const onOrphan = vi.fn();
    const { instance } = await setup({ storage: 'memory', onOrphan });
    instance.import([
      {
        version: 1,
        id: 'x',
        quote: 'text from another page',
        prefix: '',
        suffix: '',
        start: 0,
        end: 22,
        color: 'yellow',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(onOrphan).toHaveBeenCalledWith(expect.objectContaining({ id: 'x' }));
    expect(instance.getRange('x')).toBeNull();
  });

  test('imports are persisted', async () => {
    const storage = spyStorage();
    const { instance } = await setup({ storage, saveDelay: 0 });
    instance.import([
      {
        version: 1,
        id: 'q',
        quote: 'quick',
        prefix: 'The ',
        suffix: ' brown',
        start: 4,
        end: 9,
        color: 'yellow',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(storage.save).toHaveBeenCalledWith('doc', [expect.objectContaining({ id: 'q' })]);
  });
});

describe('W3C', () => {
  test('round-trips through toW3C / fromW3C', async () => {
    const { root, instance } = await setup({ storage: 'memory' });
    instance.create(find(root, 'quick'), { note: 'A note', meta: { by: 'me' } });
    instance.create(find(root, 'lazy'), { color: 'green', editable: false });
    const annotations = instance.getAll();
    const w3c = toW3C(annotations, { source: 'https://example.com/post' });
    expect(w3c[0]).toEqual({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: `urn:uuid:${annotations[0]!.id}`,
      type: 'Annotation',
      motivation: 'commenting',
      created: annotations[0]!.createdAt,
      modified: annotations[0]!.updatedAt,
      body: { type: 'TextualBody', value: 'A note', purpose: 'commenting', format: 'text/plain' },
      target: {
        source: 'https://example.com/post',
        selector: [
          {
            type: 'TextQuoteSelector',
            exact: 'quick',
            prefix: 'The ',
            suffix: annotations[0]!.suffix,
          },
          { type: 'TextPositionSelector', start: 4, end: 9 },
        ],
      },
      penciled: { color: 'yellow', meta: { by: 'me' } },
    });
    expect(w3c[1]).toMatchObject({
      motivation: 'highlighting',
      penciled: { color: 'green', editable: false },
    });
    expect(w3c[1]).not.toHaveProperty('body');
    expect(fromW3C(JSON.parse(JSON.stringify(w3c)))).toEqual(annotations);
  });

  test('reads annotations from other tools', () => {
    const [a] = fromW3C(
      {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        id: 'https://example.org/anno/1',
        type: 'Annotation',
        body: [{ type: 'TextualBody', value: 'Interesting' }],
        target: [
          {
            source: 'https://example.org/page',
            selector: { type: 'TextQuoteSelector', exact: 'lazy dog' },
          },
        ],
      },
      { color: 'blue' },
    );
    expect(a).toMatchObject({
      version: 1,
      id: 'https://example.org/anno/1',
      quote: 'lazy dog',
      prefix: '',
      suffix: '',
      color: 'blue',
      note: 'Interesting',
    });
  });

  test('skips annotations without a TextQuoteSelector', () => {
    expect(
      fromW3C([{ target: { selector: { type: 'CssSelector' } } }, { target: { source: 'x' } }]),
    ).toEqual([]);
  });

  test('foreign annotations anchor by quote', async () => {
    const { instance } = await setup({ storage: 'memory' });
    instance.import(
      fromW3C({ target: { selector: { type: 'TextQuoteSelector', exact: 'five dozen' } } }),
    );
    expect(painted('penciled-yellow')).toEqual(['five dozen']);
  });
});
