/**
 * A whitespace-collapsed view of a container's text. Every run of whitespace counts as one space
 * and leading whitespace is dropped, so re-indenting or reformatting markup doesn't move offsets.
 * All selectors (`quote`, `start`, `end`, …) are expressed in this text.
 */
export interface TextIndex {
  readonly text: string;
  /** Converts a DOM point to an offset. Points outside the root clamp to its edges. */
  offset(node: Node, offset: number): number;
  /** Builds a DOM range covering `text.slice(start, end)`. */
  range(start: number, end: number): Range;
}

const RUNS = /\s+/g;
const SPACE = /\s/;
// Content that isn't readable text. The library's own UI (`data-penciled`) is skipped too.
const SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/;

export function buildIndex(root: Node): TextIndex {
  const nodes: Text[] = [];
  const starts: number[] = [];
  const position = new Map<Node, number>();
  let text = '';
  const walker = document.createTreeWalker(root, 5 /* SHOW_ELEMENT | SHOW_TEXT */, {
    acceptNode: (n) =>
      n.nodeType === 1 && (SKIP.test(n.nodeName) || (n as Element).hasAttribute('data-penciled'))
        ? 2 // FILTER_REJECT skips the whole subtree
        : 1,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType !== 3) continue;
    let s = (n as Text).data.replace(RUNS, ' ');
    if (s[0] === ' ' && (!text || text.endsWith(' '))) s = s.slice(1);
    position.set(n, nodes.length);
    nodes.push(n as Text);
    starts.push(text.length);
    text += s;
  }

  // Walks node `i` character by character, calling `visit(j, k)` for each character `j` that
  // survives collapsing, with its offset `k` in `text`. Stops when `visit` returns true.
  const walk = (i: number, visit: (j: number, k: number) => boolean | undefined): number => {
    const data = nodes[i]!.data;
    let k = starts[i]!;
    let ws = !k || text[k - 1] === ' ';
    for (let j = 0; j < data.length; j++) {
      const w = SPACE.test(data[j]!);
      if (!(w && ws)) {
        if (visit(j, k)) return k;
        k++;
      }
      ws = w;
    }
    return k;
  };

  const point = (o: number, end: boolean): [Node, number] => {
    // An end point sits right after its last character, so it never swallows collapsed space.
    const after = end && o > 0;
    if (after) o--;
    const last = nodes[nodes.length - 1];
    if (o >= text.length || !last) return last ? [last, last.data.length] : [root, 0];
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= o) lo = mid;
      else hi = mid - 1;
    }
    let at = 0;
    walk(lo, (j, k) => {
      at = j + (after ? 1 : 0);
      return k === o;
    });
    return [nodes[lo]!, at];
  };

  return {
    text,
    offset(node, offset) {
      const i = position.get(node);
      if (i !== undefined) return walk(i, (j) => j >= offset);
      // Element points, or text we skipped: the offset of the first indexed node after the point.
      const here = document.createRange();
      here.setStart(node, offset);
      let lo = 0;
      let hi = nodes.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (here.comparePoint(nodes[mid]!, 0) < 0) lo = mid + 1;
        else hi = mid;
      }
      return lo < nodes.length ? starts[lo]! : text.length;
    },
    range(start, end) {
      const r = document.createRange();
      r.setStart(...point(start, false));
      r.setEnd(...point(end, true));
      return r;
    },
  };
}
