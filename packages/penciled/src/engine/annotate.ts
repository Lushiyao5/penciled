import { anchor, describeRange, selectorAt } from './anchoring/selector.ts';
import { buildIndex, type TextIndex } from './anchoring/text.ts';
import { highlightRenderer, innermost, type Span, segments } from './render.ts';
import { localStorageAdapter, memoryAdapter, persister } from './storage.ts';
import type {
  AnnotateOptions,
  Annotation,
  AnnotationStorage,
  Annotator,
  AnnotatorEvents,
  ExportData,
} from './types.ts';
import { dev, emitter, normalize, now, warn } from './util.ts';

const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'];
/** A selection made without a pointer (keyboard, touch handles) counts once it rests this long. */
const SETTLE = 150;
/** Content changes are batched for at least this long before re-anchoring. */
const MUTATION_DELAY = 100;
/** Between re-anchors, wait this many times as long as the last one took. */
const BACKOFF = 10;
const OBSERVE: MutationObserverInit = { childList: true, characterData: true, subtree: true };
const EVENTS = ['create', 'update', 'delete', 'orphan', 'load', 'error', 'select'] as const;

type Spot = Span & { id?: string };

const live = new Set<string>();
let warned = false;

/**
 * Enables highlights and notes on `target`, with no UI. Without the CSS Custom Highlight API it
 * warns and returns an instance that does nothing.
 */
export function annotate(target: Element | string, options: AnnotateOptions = {}): Annotator {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) throw new Error(`[penciled] No element matches "${target}".`);
  if (typeof CSS === 'undefined' || !CSS.highlights) {
    warn('This browser lacks the CSS Custom Highlight API, so annotations are disabled.');
    return inert(container, options.documentId ?? location.pathname);
  }

  const {
    readOnly = false,
    noteIndicator = false,
    observe = true,
    saveDelay = 300,
    colors = COLORS,
  } = options;
  const defaultColor = options.defaultColor ?? colors[0] ?? 'yellow';
  const documentId = options.documentId ?? defaultId(container);
  live.add(documentId);

  const events = emitter<AnnotatorEvents>();
  for (const name of EVENTS) {
    const listener =
      options[`on${name[0]!.toUpperCase()}${name.slice(1)}` as `on${Capitalize<typeof name>}`];
    if (listener) events.on(name, listener as never);
  }
  const error = (e: unknown) => (events.has('error') ? events.emit('error', e) : console.error(e));

  const store = new Map<string, Annotation>();
  // Where each annotation currently is. Orphans have no entry.
  const spans = new Map<string, Span & { id: string }>();
  const orphans = new Set<string>();
  const renderer = highlightRenderer();
  const local = !options.storage || options.storage === 'local';
  const storage =
    options.storage === 'memory'
      ? memoryAdapter()
      : local
        ? localStorageAdapter()
        : (options.storage as AnnotationStorage);
  const position = (a: Annotation) => spans.get(a.id)?.start ?? a.start;
  const getAll = () =>
    [...store.values()].sort((a, b) => position(a) - position(b)).map((a) => ({ ...a }));
  const saver = persister(storage, documentId, getAll, error, saveDelay);

  let index: TextIndex;
  // Painted ranges by `start end`, reused while the index stands so repaints touch only changes.
  let painted = new Map<string, Range>();
  let dirty = true;
  let destroyed = false;
  // What `select` last reported.
  let current: Spot | null = null;
  let mutationTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerDown = false;
  // How long the last refresh took.
  let cost = 0;

  // The index, rebuilt (and everything re-anchored) if the content changed since.
  const fresh = (): TextIndex => {
    if (dirty) refresh();
    return index;
  };

  const refresh = () => {
    const t = performance.now();
    dirty = false;
    clearTimeout(mutationTimer);
    mutationTimer = undefined;
    index = buildIndex(container);
    painted.clear();
    place([...store.values()]);
    paint();
    cost = performance.now() - t;
  };

  // A refresh rebuilds the whole index, so on pages that change constantly (feeds, tickers) they
  // are spaced out to take at most about a tenth of the main thread, and run when it's idle.
  // Hidden tabs wait until they're shown.
  // Later changes join the pending batch rather than postpone it, which on a page that changes
  // faster than the delay would postpone it forever.
  const schedule = () => {
    if (mutationTimer || document.hidden) return;
    mutationTimer = setTimeout(
      () => idle(() => dirty && !destroyed && refresh()),
      Math.max(MUTATION_DELAY, cost * BACKOFF),
    );
  };

  const place = (list: Annotation[]) => {
    // Edits shift everything after them alike, so each annotation is first checked where the
    // previous one moved to: a full search for a short, common quote is slow.
    let shift = 0;
    for (const a of [...list].sort((x, y) => x.start - y.start)) {
      const at = anchor(index.text, { ...a, start: a.start + shift, end: a.end + shift });
      if (at) {
        shift = at[0] - a.start;
        spans.set(a.id, { start: at[0], end: at[1], id: a.id });
        orphans.delete(a.id);
      } else {
        spans.delete(a.id);
        if (!orphans.has(a.id)) {
          orphans.add(a.id);
          events.emit('orphan', { ...a });
        }
      }
    }
  };

  const paint = () => {
    const next = new Map<string, Range>();
    renderer.paint(
      segments([...spans.values()]).map(([start, end, { id }]) => {
        const a = store.get(id)!;
        const key = `${start} ${end}`;
        const range = painted.get(key) ?? index.range(start, end);
        next.set(key, range);
        return {
          range,
          color: colors.includes(a.color) ? a.color : defaultColor,
          noted: noteIndicator === 'underline' && !!a.note,
        };
      }),
    );
    painted = next;
    activate();
  };

  const activate = () => {
    const s = current?.id && spans.get(current.id);
    renderer.activate(s ? index.range(s.start, s.end) : null);
  };

  const select = (next: Spot | null) => {
    if (next?.id === current?.id && next?.start === current?.start && next?.end === current?.end) {
      return;
    }
    current = next;
    activate();
    const a = next?.id ? store.get(next.id) : undefined;
    events.emit(
      'select',
      next && {
        text: index.text.slice(next.start, next.end),
        range: index.range(next.start, next.end),
        ...(a && { annotation: { ...a } }),
        editable: !readOnly && a?.editable !== false,
      },
    );
  };

  // The annotation covering exactly `range`, or the trimmed span of `range`.
  const spotOf = (range: Range): Spot | undefined => {
    const sel = describeRange(fresh(), range);
    if (!sel) return;
    for (const s of spans.values()) if (s.start === sel.start && s.end === sel.end) return s;
    return { start: sel.start, end: sel.end };
  };

  // The innermost annotation under the viewport point (x, y).
  const hit = (x: number, y: number): Spot | undefined => {
    // Nothing to hit, and no reason to build the index for a click.
    if (!spans.size) return;
    const caret = caretAt(x, y);
    if (!caret) return;
    const idx = fresh();
    const o = idx.offset(caret[0], caret[1]);
    // The caret sits between two characters; find the one actually under the point.
    for (const c of [o, o - 1]) {
      if (c < 0 || c >= idx.text.length) continue;
      for (const r of idx.range(c, c + 1).getClientRects()) {
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return innermost([...spans.values()], c, c + 1);
        }
      }
    }
  };

  const inside = (n: Node | null) => !!n && container.contains(n);

  // Reports a non-collapsed selection. Returns false if there is none.
  const readSelection = (): boolean => {
    const sel = getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || range.collapsed) return false;
    const spot =
      inside(range.startContainer) && inside(range.endContainer) ? spotOf(range) : undefined;
    select(spot && (spot.id || !readOnly) ? spot : null);
    return true;
  };

  const controller = new AbortController();
  const listen = (on: EventTarget, type: string, fn: (e: Event) => void) =>
    on.addEventListener(type, fn, { signal: controller.signal });

  for (const type of ['pointerdown', 'pointercancel']) {
    listen(document, type, () => {
      pointerDown = type === 'pointerdown';
    });
  }
  listen(document, 'pointerup', (e) => {
    pointerDown = false;
    clearTimeout(settleTimer);
    const { target, clientX, clientY } = e as PointerEvent;
    // Clicks in penciled's own UI must not dismiss what that UI is showing.
    if (own(target as Node) || readSelection()) return;
    select((inside(target as Node) && hit(clientX, clientY)) || null);
  });
  listen(document, 'selectionchange', () => {
    // Focus in penciled's UI (the note editor) moves the selection without dismissing anything.
    if (pointerDown || own(document.activeElement)) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      // A collapsed selection only dismisses text selections; clicks dismiss annotations.
      if (!readSelection() && current && !current.id) select(null);
    }, SETTLE);
  });
  listen(window, 'pagehide', saver.flush);
  listen(document, 'visibilitychange', () => dirty && store.size && observer && schedule());

  const observer = observe
    ? new MutationObserver((records) => {
        const external = records.some(
          (r) =>
            !own(r.target) &&
            (r.type !== 'childList' || ![...r.addedNodes, ...r.removedNodes].every(own)),
        );
        if (!external) return;
        dirty = true;
        schedule();
      })
    : undefined;
  // Without annotations there is nothing to re-anchor: most pages have none, and on a busy one
  // observing alone has a cost. The index is then built on demand, when text is selected.
  const watch = () => {
    if (!observer) return;
    if (store.size) return observer.observe(container, OBSERVE);
    observer.disconnect();
    dirty = true;
  };

  const ready = (async () => {
    // After a failed load nothing is written: saving could overwrite what couldn't be read.
    // Unreadable localStorage data is lost anyway, so it is replaced.
    let loaded = true;
    try {
      for (const raw of await storage.load(documentId)) {
        const a = normalize(raw, defaultColor);
        if (a && !store.has(a.id)) store.set(a.id, a);
      }
    } catch (e) {
      loaded = local;
      error(e);
    }
    if (destroyed) return;
    if (store.size) refresh();
    watch();
    if (loaded) saver.start();
    events.emit('load', getAll());
  })();

  const remove = (id: string) => {
    const a = store.get(id);
    if (!a) return;
    fresh();
    store.delete(id);
    spans.delete(id);
    orphans.delete(id);
    if (current?.id === id) select(null);
    paint();
    watch();
    events.emit('delete', { ...a });
    saver.queue('delete', id);
  };

  return {
    documentId,
    container,
    ready,
    create(range, init = {}) {
      const spot = spotOf(range);
      if (!spot) return;
      if (spot.id) return { ...store.get(spot.id)! };
      // normalize() assigns the id and timestamps.
      const a = normalize(
        { ...selectorAt(index.text, spot.start, spot.end), ...init },
        defaultColor,
      )!;
      store.set(a.id, a);
      spans.set(a.id, { start: spot.start, end: spot.end, id: a.id });
      paint();
      watch();
      events.emit('create', { ...a });
      saver.queue('create', a.id);
      // The selected text became this annotation.
      if (current && !current.id && current.start === spot.start && current.end === spot.end) {
        select(spans.get(a.id)!);
      }
      return { ...a };
    },
    get: (id) => {
      const a = store.get(id);
      return a && { ...a };
    },
    getAll,
    getRange(id) {
      const idx = fresh();
      const s = spans.get(id);
      return s ? idx.range(s.start, s.end) : null;
    },
    update(id, patch) {
      const a = store.get(id);
      if (!a) return;
      fresh();
      const next: Annotation = { ...a, updatedAt: now() };
      if (patch.color) next.color = patch.color;
      if (patch.editable !== undefined) next.editable = patch.editable;
      if (patch.meta) next.meta = patch.meta;
      if (patch.note) next.note = patch.note;
      else if (patch.note !== undefined) delete next.note;
      store.set(id, next);
      paint();
      events.emit('update', { ...next });
      saver.queue('update', id);
      return { ...next };
    },
    remove,
    clear() {
      for (const id of [...store.keys()]) remove(id);
    },
    focus(id) {
      const idx = fresh();
      const s = spans.get(id);
      if (!s) return;
      const start = idx.range(s.start, s.end).startContainer;
      (start instanceof Element ? start : start.parentElement)?.scrollIntoView({
        block: 'center',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      select(s);
    },
    blur: () => select(null),
    annotationAt(x, y) {
      const s = hit(x, y);
      return s && { ...store.get(s.id!)! };
    },
    refresh,
    export: (): ExportData => ({ version: 1, documentId, annotations: getAll() }),
    import(data, { mode = 'merge' } = {}) {
      const incoming: Annotation[] = [];
      for (const raw of Array.isArray(data) ? data : (data?.annotations ?? [])) {
        const a = normalize(raw, defaultColor);
        if (a) incoming.push(a);
      }
      fresh();
      if (mode === 'replace') {
        const keep = new Set(incoming.map((a) => a.id));
        for (const id of [...store.keys()]) if (!keep.has(id)) remove(id);
      }
      const existed = new Set(incoming.filter((a) => store.has(a.id)).map((a) => a.id));
      for (const a of incoming) store.set(a.id, a);
      place(incoming);
      paint();
      watch();
      for (const a of incoming) {
        const op = existed.has(a.id) ? 'update' : 'create';
        events.emit(op, { ...a });
        saver.queue(op, a.id);
      }
    },
    on: events.on,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      saver.flush();
      controller.abort();
      observer?.disconnect();
      clearTimeout(mutationTimer);
      clearTimeout(settleTimer);
      renderer.destroy();
      events.clear();
      live.delete(documentId);
    },
  };
}

// Pathname, plus the container's id, or an index when several containers share the page.
function defaultId(container: Element): string {
  const base = location.pathname + (container.id ? `#${container.id}` : '');
  let id = base;
  for (let n = 1; live.has(id); n++) id = `${base}#${n}`;
  if (dev() && !warned) {
    warned = true;
    warn(
      `No documentId given, so annotations are stored under "${id}". Set one explicitly in ` +
        'single-page apps, where the URL may not identify the content.',
    );
  }
  return id;
}

// Library UI is marked with `data-penciled`; it is neither text nor content to observe.
function own(node: Node | null): boolean {
  const el = node && (node.nodeType === 1 ? (node as Element) : node.parentElement);
  return !!el?.closest('[data-penciled]');
}

// Runs `fn` when the main thread is idle, or right away where that can't be known (Safari).
function idle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 1000 });
  else fn();
}

function caretAt(x: number, y: number): [Node, number] | undefined {
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    return p ? [p.offsetNode, p.offset] : undefined;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? [r.startContainer, r.startOffset] : undefined;
}

// An instance whose methods all do nothing.
function inert(container: Element, documentId: string): Annotator {
  const none = () => {};
  const base: Partial<Annotator> = {
    documentId,
    container,
    ready: Promise.resolve(),
    getAll: () => [],
    getRange: () => null,
    export: () => ({ version: 1, documentId, annotations: [] }),
    on: () => none,
  };
  return new Proxy(base, { get: (t, k) => t[k as keyof Annotator] ?? none }) as Annotator;
}
