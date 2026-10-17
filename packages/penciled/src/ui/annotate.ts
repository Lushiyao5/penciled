import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { annotate as engine } from '../engine/annotate.ts';
import type { SelectContext } from '../engine/types.ts';
import {
  CHECK,
  COPY,
  custom,
  defineColors,
  fill,
  h,
  icon,
  NOTE,
  PRESETS,
  shortcut,
  TRASH,
} from './dom.ts';
import type { AnnotateOptions, Annotator, Labels, Placement, Theme } from './types.ts';

const LABELS: Labels = {
  toolbar: 'Annotation',
  highlight: 'Highlight {color}',
  note: 'Add note',
  editNote: 'Edit note',
  copy: 'Copy',
  copied: 'Copied',
  remove: 'Remove',
  noteField: 'Note',
  notePlaceholder: 'Add a note…',
  save: 'Save',
  cancel: 'Cancel',
  position: 'Annotation {index} of {total}: {text}',
  empty: 'No annotations',
};
/** Matches the exit transition in styles.css. */
const EXIT = 150;
/** How long the mouse rests on a highlight before its note is previewed. */
const HOVER = 300;
/** Grace period for the mouse to cross the gap from the highlight to the preview. */
const LEAVE = 150;
const uis: object[] = [];

interface Editing {
  id: string;
  /** Created just for this note: dropped again if no note is saved. */
  fresh: boolean;
  initial: string;
  field: HTMLTextAreaElement;
}

/** Enables highlights and notes on `target`, with the default toolbar and note editor. */
export function annotate(target: Element | string, options: AnnotateOptions = {}): Annotator {
  const {
    actions = ['highlight', 'note', 'remove'],
    maxNoteLength,
    shortcuts = {},
    placement = {},
  } = options;
  const labels = { ...LABELS, ...options.labels };
  const colors = (options.colors ?? PRESETS).map((c) => (typeof c === 'string' ? { name: c } : c));
  const instance = engine(target, { ...options, colors: colors.map((c) => c.name) }) as Annotator;

  // What the card shows: a selection or an annotation.
  let ctx: SelectContext | null = null;
  let editing: Editing | null = null;
  let touch = false;

  /** A floating card positioned against the text of `range()`. */
  const floater = (range: () => Range | null | undefined, side: () => Placement, role?: string) => {
    const el = h('div', { 'data-penciled': '', 'data-penciled-popover': '', role });
    let exit: ReturnType<typeof setTimeout> | undefined;
    const f = {
      el,
      open: false,
      place() {
        // Measured now: Floating UI reads the reference asynchronously, by when the card may be
        // closing and its range gone, which would send it to the corner of the viewport.
        const r = range();
        if (!r) return;
        // The line nearest the card, at the range's full height.
        const all = r.getBoundingClientRect();
        const lines = [...r.getClientRects()].filter((l) => l.width);
        const line = (side().startsWith('bottom') ? lines[lines.length - 1] : lines[0]) ?? all;
        const rect = new DOMRect(line.left, all.top, line.width, all.height);
        computePosition(
          { contextElement: instance.container, getBoundingClientRect: () => rect },
          el,
          {
            placement: side(),
            strategy: 'fixed',
            middleware: [offset(8), flip(), shift({ padding: 8 })],
          },
        ).then(({ x, y, placement }) => {
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.setAttribute('data-penciled-side', placement);
        });
      },
      show(content: Node[]) {
        clearTimeout(exit);
        el.removeAttribute('data-penciled-closing');
        el.replaceChildren(...content);
        f.open = true;
        if (!el.isConnected) document.body.append(el);
        f.place();
      },
      hide() {
        if (!f.open) return;
        f.open = false;
        el.setAttribute('data-penciled-closing', '');
        exit = setTimeout(() => el.remove(), EXIT);
      },
    };
    return f;
  };

  const card = floater(
    () => (ctx?.annotation ? instance.getRange(ctx.annotation.id) : ctx?.range),
    () => {
      const side = editing ? (placement.editor ?? 'bottom') : (placement.toolbar ?? 'auto');
      return side === 'auto' ? (touch ? 'bottom' : 'top') : side;
    },
  );
  const pop = card.el;
  // The annotation whose note is previewed on hover.
  let peeked: string | undefined;
  const tip = floater(
    () => (peeked ? instance.getRange(peeked) : null),
    () => placement.preview ?? 'top',
    'tooltip',
  );
  const setTheme = (theme: Theme) => {
    for (const el of [pop, tip.el]) el.setAttribute('data-penciled-theme', theme);
  };
  setTheme(options.theme ?? 'auto');
  // The engine is inert without the Highlight API, so there is nothing to show.
  if (!CSS.highlights) return Object.assign(instance, { setTheme });

  defineColors(colors);
  const live = h('div', { 'data-penciled': '', 'data-penciled-live': '', 'aria-live': 'polite' });
  document.body.append(live);
  const self = {};
  uis.push(self);
  const keys = shortcuts && {
    toolbar: shortcut(shortcuts.toolbar ?? 'Alt+A'),
    next: shortcut(shortcuts.next ?? 'Alt+]'),
    previous: shortcut(shortcuts.previous ?? 'Alt+['),
  };

  // Where focus was before it moved into the popover.
  let restore: HTMLElement | null = null;
  // The last annotation visited by keyboard, so cycling resumes after the toolbar closes.
  let cursor: string | undefined;
  let hover: ReturnType<typeof setTimeout> | undefined;

  const current = () => ctx?.annotation && instance.get(ctx.annotation.id);
  const announce = (message: string) => {
    live.textContent = '';
    requestAnimationFrame(() => {
      live.textContent = message;
    });
  };

  const focusIn = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    for (const b of pop.querySelectorAll('[role=toolbar] button')) b.setAttribute('tabindex', '-1');
    el.tabIndex = 0;
    el.focus({ preventScroll: true });
  };

  const open = (content: Node[]) => {
    const active = document.activeElement as HTMLElement;
    const key = pop.contains(active) && active.dataset.penciledAction;
    unpeek();
    card.show(content);
    if (key) focusIn(pop.querySelector<HTMLElement>(`[data-penciled-action="${CSS.escape(key)}"]`));
  };

  const close = () => {
    ctx = null;
    editing = null;
    card.hide();
  };

  /** Previews the note of annotation `id` after a short rest, or hides the preview. */
  const peek = (id?: string) => {
    clearTimeout(hover);
    if (id === peeked) return;
    hover = setTimeout(
      () => {
        peeked = id;
        const note = id && instance.get(id)?.note;
        if (note) tip.show([h('p', { 'data-penciled-note': '' }, note)]);
        else tip.hide();
      },
      id ? HOVER : LEAVE,
    );
  };
  const unpeek = () => {
    clearTimeout(hover);
    peeked = undefined;
    tip.hide();
  };

  // Gives focus back if the popover holds it.
  const back = () => {
    const active = document.activeElement as HTMLElement;
    if (!pop.contains(active)) return;
    if (restore?.isConnected) restore.focus({ preventScroll: true });
    else active.blur();
  };

  const dismiss = () => {
    back();
    instance.blur();
    close();
  };

  /** Applies the open note editor: `keep` saves its text, otherwise it is discarded. */
  const commit = (keep: boolean) => {
    const e = editing;
    if (!e) return;
    back();
    const note = e.field.value.trim();
    if (e.fresh && !(keep && note)) {
      editing = null;
      instance.remove(e.id);
      return;
    }
    // Still editing during the update, so the closing editor isn't re-rendered as the toolbar.
    if (keep && note !== e.initial) instance.update(e.id, { note });
    editing = null;
  };

  const edit = () => {
    let a = current();
    let fresh = false;
    if (!a) {
      a = instance.create(ctx!.range);
      if (!a) return;
      fresh = true;
      getSelection()?.removeAllRanges();
    }
    const initial = a.note ?? '';
    const field = h('textarea', {
      'aria-label': labels.noteField,
      placeholder: labels.notePlaceholder,
      rows: 1,
      maxlength: maxNoteLength,
      'aria-keyshortcuts': 'Control+Enter Meta+Enter',
    });
    field.value = initial;
    const grow = () => {
      field.style.height = '';
      field.style.height = `${field.scrollHeight}px`;
    };
    field.oninput = () => {
      grow();
      card.place();
    };
    const finish = (keep: boolean) => () => {
      commit(keep);
      dismiss();
    };
    field.onkeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        finish(true)();
      }
    };
    const save = h(
      'button',
      { type: 'button', 'data-penciled-primary': '' },
      labels.save,
      h('kbd', { 'aria-hidden': 'true' }, /Mac|iP/.test(navigator.platform) ? '⌘↵' : 'Ctrl ↵'),
    );
    const cancel = h('button', { type: 'button' }, labels.cancel);
    save.onclick = finish(true);
    cancel.onclick = finish(false);
    editing = { id: a.id, fresh, initial, field };
    open([h('div', { 'data-penciled-editor': '' }, field, h('div', {}, cancel, save))]);
    grow();
    field.focus({ preventScroll: true });
  };

  const toolbar = (): Node[] => {
    const c = ctx!;
    const a = current();
    const bar = h('div', { role: 'toolbar', 'aria-label': labels.toolbar });
    const button = (
      key: string,
      label: string,
      content: Node | string,
      run: (b: HTMLButtonElement) => void,
      pressed?: boolean,
    ) => {
      const b = h('button', {
        type: 'button',
        tabindex: bar.childElementCount ? -1 : 0,
        'data-penciled-action': key,
        'aria-label': label,
        title: label,
        'aria-pressed': pressed === undefined ? undefined : `${pressed}`,
        'data-penciled-swatch': pressed !== undefined,
      });
      b.append(content);
      b.onclick = () => run(b);
      bar.append(b);
    };
    for (const action of actions) {
      if (typeof action === 'object') {
        button(action.id, action.label, action.icon ? custom(action.icon) : action.label, () => {
          action.onSelect(c);
          dismiss();
        });
        continue;
      }
      if (action === 'copy') {
        button('copy', labels.copy, icon(COPY), (b) => {
          navigator.clipboard?.writeText(c.text);
          announce(labels.copied);
          b.replaceChildren(icon(CHECK));
          setTimeout(() => b.replaceChildren(icon(COPY)), 1200);
        });
      }
      // Everything else edits.
      if (!c.editable) continue;
      if (action === 'highlight') {
        for (const { name, label = name } of colors) {
          const swatch = h('span');
          swatch.style.setProperty('--penciled-swatch', `var(--${CSS.escape(`penciled-${name}`)})`);
          button(
            `color-${name}`,
            fill(labels.highlight, { color: label }),
            swatch,
            () => {
              if (a) instance.update(a.id, { color: name });
              else {
                instance.create(c.range, { color: name });
                getSelection()?.removeAllRanges();
              }
            },
            a?.color === name,
          );
        }
      } else if (action === 'note') {
        button('note', a?.note ? labels.editNote : labels.note, icon(NOTE), edit);
      } else if (action === 'remove' && a) {
        button('remove', labels.remove, icon(TRASH), () => instance.remove(a.id));
      }
    }
    // A few icon actions (no colors) sit beside the note instead of in a row of their own.
    if (!bar.querySelector('[data-penciled-swatch]')) bar.setAttribute('data-penciled-inline', '');
    bar.onkeydown = (e) => {
      const items = [...bar.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: -1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      focusIn(items.at(to % items.length));
    };
    const out: Node[] = a?.note ? [h('p', { 'data-penciled-note': '' }, a.note)] : [];
    if (bar.childElementCount) out.push(bar);
    return out;
  };

  const render = () => {
    const content = ctx && toolbar();
    if (content?.length) open(content);
    else close();
  };

  const cycle = (step: number) => {
    const list = instance.getAll().filter((a) => instance.getRange(a.id));
    const total = list.length;
    if (!total) return announce(labels.empty);
    const i = list.findIndex((a) => a.id === (ctx?.annotation?.id ?? cursor));
    const a = list[i < 0 ? (step > 0 ? 0 : total - 1) : (i + step + total) % total]!;
    cursor = a.id;
    instance.focus(a.id);
    announce(
      fill(labels.position, { index: list.indexOf(a) + 1, total, text: a.quote }) +
        (a.note ? `. ${a.note}` : ''),
    );
  };

  // Several instances can share a page: keyboard cycling goes to the one the reader is in.
  const mine = () => {
    const active = document.activeElement;
    const anchor = getSelection()?.anchorNode;
    const has = (n: Node | null | undefined) =>
      !!n && (instance.container.contains(n) || pop.contains(n));
    return has(active) || has(anchor) || (active === document.body && !anchor && uis[0] === self);
  };

  instance.on('select', (next) => {
    ctx = next;
    commit(true);
    if (next?.annotation) cursor = next.annotation.id;
    render();
  });
  instance.on('update', (a) => {
    if (!editing && ctx?.annotation?.id === a.id) render();
    if (a.id === peeked) unpeek();
  });
  instance.on('delete', (a) => {
    if (a.id === peeked) unpeek();
  });

  const controller = new AbortController();
  const listen = <K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
  ) => document.addEventListener(type, fn, { signal: controller.signal });

  // Follow the text when the page or any scroll container scrolls, or the viewport resizes.
  for (const type of ['scroll', 'resize']) {
    addEventListener(
      type,
      () => {
        for (const f of [card, tip]) if (f.open) f.place();
      },
      {
        capture: true,
        passive: true,
        signal: controller.signal,
      },
    );
  }
  listen('pointerdown', (e) => {
    touch = e.pointerType === 'touch';
  });
  if (options.notePreview === 'hover') {
    let last: PointerEvent | undefined;
    const check = () => {
      const { target, clientX, clientY, buttons } = last!;
      last = undefined;
      // Not while the toolbar is open or a selection is being dragged.
      if (card.open || buttons) return unpeek();
      // The preview stays while the mouse is on it, so its text can be selected.
      if (tip.el.contains(target as Node)) return peek(peeked);
      const a = instance.container.contains(target as Node)
        ? instance.annotationAt(clientX, clientY)
        : undefined;
      peek(a?.note ? a.id : undefined);
    };
    listen('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      // Hit-testing once per frame is plenty.
      if (!last) requestAnimationFrame(check);
      last = e;
    });
    // The mouse left the window.
    listen('pointerout', (e) => {
      if (!e.relatedTarget) peek();
    });
  }
  listen('keydown', (e) => {
    if (e.key === 'Escape') unpeek();
    if (e.key === 'Escape' && card.open) {
      e.preventDefault();
      commit(false);
      return dismiss();
    }
    const el = e.target as HTMLElement;
    if (!keys || el.isContentEditable || el.closest?.('input,textarea,select')) return;
    if (keys.toolbar(e) && card.open && !editing) {
      e.preventDefault();
      focusIn(pop.querySelector<HTMLElement>('[role=toolbar] [tabindex="0"]'));
    } else if ((keys.next(e) || keys.previous(e)) && mine()) {
      e.preventDefault();
      cycle(keys.next(e) ? 1 : -1);
    }
  });
  // Keep the text selection (and focus) when the toolbar is clicked.
  pop.addEventListener('mousedown', (e) => {
    if (!(e.target as Element).closest('textarea')) e.preventDefault();
  });
  pop.addEventListener('focusin', (e) => {
    if (!pop.contains(e.relatedTarget as Node)) restore = e.relatedTarget as HTMLElement | null;
  });

  const destroy = instance.destroy;
  return Object.assign(instance, {
    setTheme,
    destroy() {
      if (!uis.includes(self)) return;
      controller.abort();
      clearTimeout(hover);
      pop.remove();
      tip.el.remove();
      live.remove();
      uis.splice(uis.indexOf(self), 1);
      destroy();
    },
  });
}
