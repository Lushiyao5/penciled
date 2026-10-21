type Attrs = Record<string, string | number | boolean | undefined>;

/** Creates an element. Strings become text nodes, so stored text is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | false | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : `${v}`);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}
