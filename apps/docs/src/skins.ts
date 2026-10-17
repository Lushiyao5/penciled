// The looks in the landing page's "Make it yours" section. The CSS shown on the page is the CSS
// the page runs: `scoped()` only gates it behind `data-skin` on <html>, so a look can be undone.

export interface Skin {
  id: string;
  label: string;
  css: string;
  /** False when the CSS is already part of the site's own styles (tokens.css). */
  inject: boolean;
}

export const skins: Skin[] = [
  {
    id: 'site',
    label: 'This site',
    inject: false,
    css: `/* penciled/styles.css, plus five lines to match this site. */
:root {
  --penciled-font: 'Geist Variable', sans-serif;
  --penciled-bg: light-dark(#fff, #201f1d);
  --penciled-border: light-dark(#e7e4de, #ffffff14);
  --penciled-accent: light-dark(#1c1b19, #ece9e4);
  --penciled-accent-fg: light-dark(#fbfaf8, #141413);
}`,
  },
  {
    id: 'rounded',
    label: 'Rounded',
    inject: true,
    css: `:root {
  --penciled-radius: 18px;
  --penciled-bg: light-dark(#eef2ff, #1e1b4b);
  --penciled-border: light-dark(#c7d2fe, #4338ca80);
  --penciled-hover: light-dark(#e0e7ff, #312e81);
  --penciled-accent: light-dark(#4f46e5, #a5b4fc);
  --penciled-accent-fg: light-dark(#fff, #1e1b4b);
  --penciled-ring: light-dark(#4f46e5, #a5b4fc);
  --penciled-shadow: 0 12px 32px -10px #4f46e580;
}

/* Anything else, through the data-penciled hooks. */
[data-penciled-popover] button {
  border-radius: 999px;
}`,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    inject: true,
    css: `:root {
  --penciled-font: 'Source Serif 4 Variable', Georgia, serif;
  --penciled-radius: 3px;
  --penciled-bg: light-dark(#fffdf7, #1f1c17);
  --penciled-border: light-dark(#d9d0bd, #4a4237);
  --penciled-hover: light-dark(#f3ecdc, #2c2820);
  --penciled-accent: light-dark(#9a3412, #fdba74);
  --penciled-accent-fg: light-dark(#fffdf7, #1f1c17);
  --penciled-shadow: none;
  --penciled-yellow: light-dark(#fdba7466, #fb923c33);
  --penciled-noted: underline solid 1px;
}

[data-penciled-note] {
  font-style: italic;
  font-size: 15px;
}`,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    inject: true,
    css: `:root {
  --penciled-font: 'Geist Mono Variable', ui-monospace, monospace;
  --penciled-radius: 0;
  --penciled-bg: #0a0a0a;
  --penciled-fg: #4ade80;
  --penciled-muted: #4ade8099;
  --penciled-border: #4ade80;
  --penciled-hover: #4ade8026;
  --penciled-accent: #4ade80;
  --penciled-accent-fg: #0a0a0a;
  --penciled-ring: #4ade80;
  --penciled-shadow: 4px 4px 0 #4ade8040;
  --penciled-yellow: #fbbf2459;
}`,
  },
];

/** A skin's CSS, applied only while `<html data-skin>` names it. */
export function scoped({ id, css }: Skin): string {
  return css
    .replace(/^:root/gm, `:root[data-skin='${id}']`)
    .replace(/^\[data-penciled/gm, `[data-skin='${id}'] [data-penciled`);
}
