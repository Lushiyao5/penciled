import type { Annotation } from '../types.ts';
import type { TextIndex } from './text.ts';

/** TextQuote + TextPosition selectors, in the whitespace-collapsed text of a container. */
export type Selector = Pick<Annotation, 'quote' | 'prefix' | 'suffix' | 'start' | 'end'>;

type Candidate = [start: number, end: number, errors: number];

/** Characters of context stored on each side of the quote. */
const CONTEXT = 32;
/** A candidate's context must be at least this similar to the stored one… */
const MIN_CONTEXT = 0.5;
/** …unless it is the only exact match of a quote at least this long. */
const LONG_QUOTE = 20;
/** The stored position is trusted when the quote matches there and the context is this similar. */
const POSITION_CONTEXT = 0.8;
/** The best candidate must beat the runner-up by this much (score = quote + context, 0–2). */
const MARGIN = 0.15;
/** Fuzzy matches may differ from the quote in up to this share of its characters. */
const MAX_ERRORS = 0.25;

export function describeRange(index: TextIndex, range: Range): Selector | undefined {
  const { text } = index;
  let start = index.offset(range.startContainer, range.startOffset);
  let end = index.offset(range.endContainer, range.endOffset);
  while (start < end && text[start] === ' ') start++;
  while (end > start && text[end - 1] === ' ') end--;
  return start < end ? selectorAt(text, start, end) : undefined;
}

export function selectorAt(text: string, start: number, end: number): Selector {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
    start,
    end,
  };
}

/**
 * Finds `selector` in `text`. Returns `null` when no location can be trusted: the annotation is
 * then orphaned rather than risk highlighting the wrong text.
 */
export function anchor(text: string, selector: Selector): [number, number] | null {
  const { quote, start, end } = selector;
  if (!quote) return null;
  if (text.slice(start, end) === quote && context(text, selector, start, end) >= POSITION_CONTEXT) {
    return [start, end];
  }
  const exact: Candidate[] = [];
  for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) {
    exact.push([i, i + quote.length, 0]);
  }
  const found = pick(text, selector, exact, true);
  return found === undefined ? (pick(text, selector, fuzzy(text, selector), false) ?? null) : found;
}

/** The best trustworthy candidate, `null` if the best ones are too close to call, or `undefined`. */
function pick(
  text: string,
  selector: Selector,
  candidates: Candidate[],
  exact: boolean,
): [number, number] | null | undefined {
  const unique = exact && candidates.length === 1 && selector.quote.length >= LONG_QUOTE;
  let best: [number, number] | undefined;
  let first = -1;
  let second = -1;
  for (const [s, e, errors] of candidates) {
    const c = context(text, selector, s, e);
    if (c < MIN_CONTEXT && !unique) continue;
    const score = c + 1 - errors / selector.quote.length;
    if (score > first) {
      second = first;
      first = score;
      best = [s, e];
    } else if (score > second) second = score;
  }
  return best && first - second < MARGIN ? null : best;
}

/** How similar the text around `[s, e)` is to the stored prefix and suffix, from 0 to 1. */
function context(text: string, { prefix, suffix }: Selector, s: number, e: number): number {
  // Near the edges of the text there is less context to compare; missing characters are neutral.
  const pl = Math.min(prefix.length, s);
  const sl = Math.min(suffix.length, text.length - e);
  if (!pl && !sl) return 1;
  return (
    (similarity(prefix.slice(prefix.length - pl), text.slice(s - pl, s)) * pl +
      similarity(suffix.slice(0, sl), text.slice(e, e + sl)) * sl) /
    (pl + sl)
  );
}

/** 1 minus the normalized Levenshtein distance. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        row[j]! + 1,
        next[j - 1]! + 1,
      );
    }
    row = next;
  }
  return 1 - row[b.length]! / Math.max(a.length, b.length);
}

/**
 * Approximate occurrences of the quote with at most `MAX_ERRORS` edits, best first and
 * non-overlapping. With k errors, at least one of k + 1 chunks of the quote survives intact, so
 * exact chunk hits vote for where the quote may start; the best-supported regions are then
 * searched with Sellers' edit-distance algorithm.
 */
function fuzzy(text: string, { quote, prefix, suffix, start }: Selector): Candidate[] {
  const m = quote.length;
  const k = Math.min(Math.ceil(m * MAX_ERRORS), 64);
  const size = Math.floor(m / (k + 1));
  let windows: number[][] = [[0, text.length]];
  if (size >= 4) {
    const hits: number[] = [];
    for (let c = 0; c <= k; c++) {
      const chunk = quote.substr(c * size, size);
      for (let i = text.indexOf(chunk); i >= 0; i = text.indexOf(chunk, i + 1)) {
        hits.push(i - c * size);
      }
    }
    hits.sort((a, b) => a - b);
    // Clusters of nearby start positions: [first, last, votes].
    const clusters: number[][] = [];
    for (const h of hits) {
      const last = clusters[clusters.length - 1];
      if (last && h - last[0]! <= 2 * k) {
        last[1] = h;
        last[2]!++;
      } else clusters.push([h, h, 1]);
    }
    windows = clusters
      .sort((a, b) => b[2]! - a[2]!)
      .slice(0, 8)
      .map(([f, l]) => [Math.max(0, f! - k), Math.min(text.length, l! + m + k)]);
  }

  const found: Candidate[] = [];
  for (const [a, b] of windows as [number, number][]) {
    // Row i holds the cheapest alignment of quote[0, i) ending at each column, and its start.
    // Among equally cheap alignments the earliest start wins, so a matching head isn't dropped.
    const n = b - a;
    let cost = new Int32Array(n + 1);
    let from = new Int32Array(n + 1).map((_, j) => j);
    let nextCost = new Int32Array(n + 1);
    let nextFrom = new Int32Array(n + 1);
    for (let i = 1; i <= m; i++) {
      const q = quote.charCodeAt(i - 1);
      nextCost[0] = i;
      nextFrom[0] = 0;
      for (let j = 1; j <= n; j++) {
        let best = cost[j - 1]! + (q === text.charCodeAt(a + j - 1) ? 0 : 1);
        let s = from[j - 1]!;
        let x = cost[j]! + 1;
        if (x < best || (x === best && from[j]! < s)) {
          best = x;
          s = from[j]!;
        }
        x = nextCost[j - 1]! + 1;
        if (x < best || (x === best && nextFrom[j - 1]! < s)) {
          best = x;
          s = nextFrom[j - 1]!;
        }
        nextCost[j] = best;
        nextFrom[j] = s;
      }
      [cost, nextCost] = [nextCost, cost];
      [from, nextFrom] = [nextFrom, from];
    }
    cost.forEach((errors, j) => {
      if (errors <= k) found.push([a + from[j]!, a + j, errors]);
    });
  }

  // Edit distance alone can misplace the edges (dropping a changed head is sometimes cheaper
  // than keeping it), so move each edge to where the stored context still ends or starts nearby.
  const snap = (at: number, before: boolean): number => {
    for (const n of [8, 5]) {
      const piece = before ? prefix.slice(-n) : suffix.slice(0, n);
      if (piece.length < n) continue;
      let best = -1;
      for (
        let i = text.indexOf(piece, Math.max(0, at - k - n));
        i >= 0 && i <= at + k;
        i = text.indexOf(piece, i + 1)
      ) {
        const edge = before ? i + n : i;
        if (best < 0 || Math.abs(edge - at) < Math.abs(best - at)) best = edge;
      }
      if (best >= 0) return best;
    }
    return at;
  };

  // Keep the best of each cluster of overlapping alignments.
  found.sort((x, y) => x[2] - y[2] || Math.abs(x[0] - start) - Math.abs(y[0] - start));
  const kept: Candidate[] = [];
  for (const [s0, e0, errors] of found) {
    if (kept.some(([ks, ke]) => e0 > ks && s0 < ke)) continue;
    let s = snap(s0, true);
    let e = snap(e0, false);
    while (s < e && text[s] === ' ') s++;
    while (e > s && text[e - 1] === ' ') e--;
    if (s < e && kept.every(([ks, ke]) => e <= ks || s >= ke)) kept.push([s, e, errors]);
  }
  return kept;
}
