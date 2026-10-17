import type { Color } from './types.ts';

type Attrs = Record<string, string | number | boolean | undefined>;

/** Creates an element. Strings become text nodes, so user text is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : `${v}`);
  }
  el.append(...children);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';

export const NOTE = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 8h8M8 12h5';
export const COPY =
  'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2';
export const CHECK = 'M20 6 9 17l-5-5';
export const TRASH =
  'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2';

export function icon(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  const path = document.createElementNS(SVG, 'path');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-penciled-icon', '');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/**
 * A developer-supplied icon: an element (cloned) or SVG markup. Markup is parsed inertly as HTML,
 * which puts `<svg>` in the SVG namespace even without an `xmlns` attribute.
 */
export function custom(icon: string | Element): Node {
  return typeof icon === 'string'
    ? document.importNode(new DOMParser().parseFromString(icon, 'text/html').body, true)
        .firstElementChild!
    : icon.cloneNode(true);
}

export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k) => `${vars[k] ?? ''}`);

const CODES: Record<string, string> = { ']': 'BracketRight', '[': 'BracketLeft' };

/** A matcher for a shortcut like `'Alt+A'`. Keys match by layout or by physical position. */
export function shortcut(spec: string | undefined): (e: KeyboardEvent) => boolean {
  if (!spec) return () => false;
  const mods = spec.toLowerCase().split('+');
  const key = mods.pop() || '+';
  const code = /^[a-z]$/.test(key)
    ? `Key${key.toUpperCase()}`
    : /^\d$/.test(key)
      ? `Digit${key}`
      : CODES[key];
  return (e) =>
    (['alt', 'ctrl', 'shift', 'meta'] as const).every((m) => e[`${m}Key`] === mods.includes(m)) &&
    (e.code === code || e.key.toLowerCase() === key);
}

export const PRESETS: string[] = ['yellow', 'green', 'blue', 'pink', 'purple'];

let sheet: CSSStyleSheet | undefined;
const defined = new Set<string>();

/**
 * Registers highlight styles for colors `styles.css` doesn't cover, and sets the values of colors
 * defined in JS, in an adopted stylesheet (the host DOM is untouched).
 */
export function defineColors(colors: Color[]): void {
  for (const { name, light, dark } of colors) {
    const known = PRESETS.includes(name);
    if (known && !light) continue;
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.insertRule(':where(:root){}');
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
    const id = CSS.escape(`penciled-${name}`);
    if (!known && !defined.has(name)) {
      defined.add(name);
      sheet.insertRule(
        `::highlight(${id}),::highlight(${id}-noted){background-color:var(--${id})}`,
        1,
      );
      sheet.insertRule(`::highlight(${id}-noted){text-decoration:var(--penciled-noted)}`, 1);
    }
    if (light) {
      (sheet.cssRules[0] as CSSStyleRule).style.setProperty(
        `--penciled-${name}`,
        dark ? `light-dark(${light}, ${dark})` : light,
      );
    }
  }
}
