/**
 * penciled's highlight colors as [light page, dark page], matching styles.css. penciled picks one
 * with light-dark(), from the page's `color-scheme`, but many sites never declare one: a dark site
 * then gets the light values, which leave too little contrast for its light text, and a site that
 * declares `light dark` but is always white gets the dark ones when the OS is dark.
 */
const COLORS: Record<string, [string, string]> = {
  yellow: ['#fde04780', '#facc1547'],
  green: ['#86efac80', '#4ade803d'],
  blue: ['#93c5fd80', '#60a5fa47'],
  pink: ['#f9a8d480', '#f472b647'],
  purple: ['#c4b5fd80', '#a78bfa4d'],
  active: ['#0000001a', '#ffffff24'],
};

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

let sheet: CSSStyleSheet | undefined;

/**
 * Sets the highlight colors by the page's actual background, in an adopted stylesheet so the
 * page's DOM is untouched. Call again whenever the page may have changed theme.
 */
export function matchScheme(): void {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  const i = isDark() ? 1 : 0;
  const props = Object.entries(COLORS).map(([name, values]) => `--penciled-${name}:${values[i]}`);
  sheet.replaceSync(`:root{${props.join(';')}}`);
}
