import type {
  Annotator as Engine,
  AnnotateOptions as EngineOptions,
  SelectContext,
} from '../engine/index.ts';

export type Theme = 'light' | 'dark' | 'auto';

/**
 * A highlight color, exposed to CSS as `--penciled-<name>`. Without `light`, the value comes from
 * your CSS (the presets ship in `styles.css`).
 */
export interface Color {
  name: string;
  light?: string;
  /** Defaults to `light`. */
  dark?: string;
  /** Accessible name of the color. Defaults to `name`. */
  label?: string;
  /**
   * Keeps painting annotations that already use this color, without offering it in the toolbar
   * for new ones. Use it to retire a color without changing existing highlights.
   */
  hidden?: boolean;
}

/** A custom toolbar action. The toolbar closes after `onSelect` runs. */
export interface Action {
  id: string;
  label: string;
  /** An element, or SVG markup. Without one the label is shown. */
  icon?: string | Element;
  onSelect(ctx: SelectContext): void;
}

export type BuiltInAction = 'highlight' | 'note' | 'copy' | 'remove';

/** UI strings. `{name}` placeholders are filled in. */
export interface Labels {
  toolbar: string;
  /** `{color}`: the color's label. */
  highlight: string;
  note: string;
  editNote: string;
  copy: string;
  copied: string;
  remove: string;
  noteField: string;
  notePlaceholder: string;
  save: string;
  cancel: string;
  /** Announced while cycling with the keyboard. `{index}`, `{total}`, `{text}`. */
  position: string;
  empty: string;
}

/** Shortcuts such as `'Alt+A'`: modifiers (`Alt`, `Ctrl`, `Shift`, `Meta`) and a key. */
export interface Shortcuts {
  /**
   * Moves focus into the toolbar, first opening it for the selected text when `openOnSelect` is
   * `false`. Defaults to `Alt+A`.
   */
  toolbar?: string;
  /** Focuses the next annotation. Defaults to `Alt+]`. */
  next?: string;
  /** Focuses the previous annotation. Defaults to `Alt+[`. */
  previous?: string;
}

/** A side of the text, optionally aligned with the start or end of its nearest line. */
export type Placement = 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

/** Preferred placements. Each one still flips and shifts to stay in the viewport. */
export interface Placements {
  /**
   * The toolbar, and the note shown with it. Defaults to `'auto'`: above the text, or below it on
   * touch devices, where the OS selection menu sits above.
   */
  toolbar?: Placement | 'auto';
  /** The note editor. Defaults to `'bottom'`, so it doesn't cover the text being annotated. */
  editor?: Placement;
  /** The hover preview of a note. Defaults to `'top'`. */
  preview?: Placement;
}

export interface AnnotateOptions extends Omit<EngineOptions, 'colors'> {
  /** Color names or definitions. Defaults to yellow, green, blue, pink and purple. */
  colors?: (string | Color)[];
  /** `'auto'` (default) follows `prefers-color-scheme`. */
  theme?: Theme;
  /** Toolbar actions, in order. Defaults to `['highlight', 'note', 'remove']`. */
  actions?: (BuiltInAction | Action)[];
  maxNoteLength?: number;
  /**
   * `'hover'` shows an annotation's note when the mouse rests on it; clicking still opens the
   * toolbar. Off by default. Touch and keyboard users see notes in the toolbar.
   */
  notePreview?: 'hover' | false;
  placement?: Placements;
  labels?: Partial<Labels>;
  /**
   * `false` keeps the toolbar closed when text is selected, until the `toolbar` shortcut opens it.
   * Clicking an annotation still opens it. Defaults to `true`.
   */
  openOnSelect?: boolean;
  /** `false` disables the keyboard shortcuts. */
  shortcuts?: Shortcuts | false;
  /**
   * Where the toolbar, note preview and live region are added. Defaults to `document.body`. Pass a
   * shadow root to keep page CSS away from the UI: its host is marked `data-penciled`, and
   * `styles.css` must be loaded both in the shadow root and on the page, which paints highlights.
   */
  root?: Element | ShadowRoot;
}

export interface Annotator extends Engine {
  setTheme(theme: Theme): void;
}
