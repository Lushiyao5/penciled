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

const SVG = 'http://www.w3.org/2000/svg';

/** A 16px stroked icon, drawn from `shapes`: `['path', { d }]`, `['rect', { … }]` and so on. */
export function icon(...shapes: [string, Record<string, string | number>][]): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  const attrs = {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, `${v}`);
  for (const [tag, shape] of shapes) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(shape)) el.setAttribute(k, `${v}`);
    svg.append(el);
  }
  return svg;
}

/** The icons the extension's pages use. */
export const ICONS = {
  sidebar: () =>
    icon(['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }], ['path', { d: 'M15 3v18' }]),
  settings: () =>
    icon(
      ['path', { d: 'M20 7h-9' }],
      ['path', { d: 'M14 17H5' }],
      ['circle', { cx: 17, cy: 17, r: 3 }],
      ['circle', { cx: 7, cy: 7, r: 3 }],
    ),
  trash: () =>
    icon(
      ['path', { d: 'M3 6h18' }],
      ['path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }],
      ['path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }],
    ),
  search: () => icon(['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'm21 21-4.3-4.3' }]),
};
