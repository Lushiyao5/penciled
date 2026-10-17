export interface Paint {
  range: AbstractRange;
  color: string;
  noted: boolean;
}

export interface Renderer {
  // Replaces everything this renderer painted. Paints never overlap (see `segments`).
  paint(items: Paint[]): void;
  // Marks one range as active (open in the UI or focused), or none.
  activate(range: AbstractRange | null): void;
  destroy(): void;
}

export interface Span {
  start: number;
  end: number;
}

/**
 * Splits overlapping spans into non-overlapping segments, each owned by the innermost (shortest)
 * span covering it, so the innermost annotation is always the one painted on top and the one a
 * click opens. Later spans win ties.
 */
export function segments<T extends Span>(spans: T[]): [start: number, end: number, owner: T][] {
  const edges = [...new Set(spans.flatMap((s) => [s.start, s.end]))].sort((a, b) => a - b);
  const out: [number, number, T][] = [];
  for (let i = 1; i < edges.length; i++) {
    const from = edges[i - 1]!;
    const to = edges[i]!;
    const owner = innermost(spans, from, to);
    const last = out[out.length - 1];
    if (!owner) continue;
    if (last && last[2] === owner && last[1] === from) last[1] = to;
    else out.push([from, to, owner]);
  }
  return out;
}

// The shortest span covering `[from, to)`.
export function innermost<T extends Span>(spans: T[], from: number, to: number): T | undefined {
  let best: T | undefined;
  for (const s of spans) {
    if (s.start <= from && s.end >= to && (!best || s.end - s.start <= best.end - best.start)) {
      best = s;
    }
  }
  return best;
}

// Highlight registries are global by name, so instances share them and count their users.
const shared = new Map<string, [Highlight, number]>();

export function highlightRenderer(): Renderer {
  // The ranges this renderer paints, by registry name.
  const owned = new Map<string, Set<AbstractRange>>();
  // A destroyed instance can still be called, e.g. by a pending frame: it must not paint again.
  let destroyed = false;

  // Moves registry `name` from this renderer's previous ranges to `next`, touching only the ranges
  // that changed, so a repaint costs as much as the change rather than the whole page.
  const put = (name: string, next = new Set<AbstractRange>()) => {
    if (destroyed) return;
    const prev = owned.get(name) ?? new Set();
    const gone = [...prev].filter((r) => !next.has(r));
    const added = [...next].filter((r) => !prev.has(r));
    if (!gone.length && !added.length) return;
    let entry = shared.get(name);
    if (!entry) {
      const h = new Highlight();
      h.priority = name === ACTIVE ? 1 : 0;
      CSS.highlights.set(name, h);
      entry = [h, 0];
      shared.set(name, entry);
    }
    const [h] = entry;
    if (gone.length > 8) {
      // Firefox deletes from a Highlight in linear time: rebuilding beats many single deletes.
      const drop = new Set(gone);
      const rest = [...h].filter((r) => !drop.has(r));
      h.clear();
      for (const r of rest) h.add(r);
    } else for (const r of gone) h.delete(r);
    for (const r of added) h.add(r);
    if (!prev.size) entry[1]++;
    if (next.size) owned.set(name, next);
    else {
      owned.delete(name);
      if (!--entry[1]) {
        CSS.highlights.delete(name);
        shared.delete(name);
      }
    }
  };

  return {
    paint(items) {
      const next = new Map<string, Set<AbstractRange>>();
      for (const p of items) {
        const name = `penciled-${p.color}${p.noted ? '-noted' : ''}`;
        next.set(name, (next.get(name) ?? new Set()).add(p.range));
      }
      // A name listed twice is unchanged the second time.
      for (const name of [...owned.keys(), ...next.keys()]) {
        if (name !== ACTIVE) put(name, next.get(name));
      }
    },
    activate: (range) => put(ACTIVE, new Set(range ? [range] : [])),
    destroy() {
      for (const name of [...owned.keys()]) put(name);
      destroyed = true;
    },
  };
}

const ACTIVE = 'penciled-active';
