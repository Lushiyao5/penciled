import type { PaletteColor } from './settings.ts';

/**
 * Highlight colors get a fixed transparency, stronger on light pages than on dark ones, so text
 * stays readable on both. penciled would pick between them with light-dark(), from the page's
 * `color-scheme`, but many sites never declare one: a dark site then gets the light values, which
 * leave too little contrast for its light text. So the page's actual background decides.
 */
const ALPHA = ['80', '47'];
const ACTIVE = ['#0000001a', '#ffffff24'];

type RGB = [number, number, number];

/** The color behind the page's text: the first opaque background from `body` up. */
function background(): RGB {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const [r = 0, g = 0, b = 0, a = 1] =
      getComputedStyle(el)
        .backgroundColor.match(/[\d.]+/g)
        ?.map(Number) ?? [];
    if (a > 0.5) return [r, g, b];
  }
  // Neither sets one, so the canvas shows: dark only with a dark color-scheme on a dark OS.
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  return scheme.includes('dark') && matchMedia('(prefers-color-scheme: dark)').matches
    ? [0, 0, 0]
    : [255, 255, 255];
}

/** Relative luminance, as defined by WCAG. */
function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whether the page's background is dark. */
export function isDark(): boolean {
  // Below this, white text has more contrast on it than black text.
  return luminance(background()) < 0.18;
}

/** A color's highlight value: `#rrggbbaa`. */
export function highlight(value: string, dark: boolean): string {
  return value + ALPHA[+dark];
}

let sheet: CSSStyleSheet | undefined;
let palette: PaletteColor[] = [];

/**
 * Sets each color's highlight value for the page's background, in an adopted stylesheet so the
 * page's DOM is untouched. Call again whenever the colors or the page's theme may have changed.
 */
export function matchScheme(colors: PaletteColor[] = palette): void {
  palette = colors;
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  const dark = isDark();
  const props = colors.map((c) => `--penciled-${c.id}:${highlight(c.value, dark)}`);
  props.push(`--penciled-active:${ACTIVE[+dark]}`);
  sheet.replaceSync(`:root{${props.join(';')}}`);
}
