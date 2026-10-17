/**
 * Mounts `html` in a fresh container. A `[[ … ]]` pair marks a range: the markers are removed
 * from the DOM and returned as a `Range`. Markers may sit in different text nodes.
 */
export function mount(html: string): { root: HTMLElement; range: Range | undefined } {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  const range = document.createRange();
  let found = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    for (const [marker, setter] of [
      ['[[', (n: Text, i: number) => range.setStart(n, i)],
      [']]', (n: Text, i: number) => range.setEnd(n, i)],
    ] as const) {
      const i = node.data.indexOf(marker);
      if (i >= 0) {
        node.deleteData(i, 2);
        setter(node, i);
        found++;
      }
    }
  }
  return { root, range: found === 2 ? range : undefined };
}

export function cleanup(): void {
  destroyAll();
  getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  localStorage.clear();
}

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const instances: { destroy(): void }[] = [];

/** Registers an instance for `cleanup()` to destroy. */
export function track<T extends { destroy(): void }>(instance: T): T {
  instances.push(instance);
  return instance;
}

export function destroyAll(): void {
  for (const i of instances.splice(0)) i.destroy();
}

/** A range over the first occurrence of `text` inside `root`, within a single text node. */
export function find(root: Node, text: string): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const i = n.data.indexOf(text);
    if (i >= 0) {
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + text.length);
      return r;
    }
  }
  throw new Error(`"${text}" not found`);
}

/** Ranges painted in the named highlight registry, as strings. */
export function painted(name: string): string[] {
  return [...((CSS.highlights.get(name) as Set<AbstractRange> | undefined) ?? [])].map((r) =>
    (r as Range).toString(),
  );
}

/** Dispatches pointerdown + pointerup at the middle of the first character of `range`. */
export function clickOn(range: Range): void {
  const rect = range.getClientRects()[0]!;
  clickAt(rect.left + 2, rect.top + rect.height / 2);
}

export function clickAt(x: number, y: number): void {
  const target = document.elementFromPoint(x, y) ?? document.body;
  for (const type of ['pointerdown', 'pointerup']) {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y }));
  }
}

/** Selects `range` as a keyboard user would, then waits for the selection to settle. */
export async function selectText(range: Range | null): Promise<void> {
  const sel = getSelection()!;
  sel.removeAllRanges();
  if (range) sel.addRange(range);
  await wait(250);
}
