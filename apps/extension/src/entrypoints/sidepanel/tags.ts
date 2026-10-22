import { h, ICONS } from '../../lib/dom.ts';
import { cleanTag } from '../../lib/tags.ts';

/** How many existing tags are suggested at once. */
const SUGGESTIONS = 6;

export interface TagEditorOptions {
  tags: string[];
  /** Every tag in use, most used first, to suggest. */
  known: string[];
  /** What's typed and not added yet. Kept by the sidebar, since updates rebuild the editor. */
  draft: string;
  onDraft: (draft: string) => void;
  onChange: (tags: string[]) => void;
  onClose: () => void;
}

let ids = 0;

/** A field of tags, with the tags in use suggested as you type. */
export function tagEditor(o: TagEditorOptions): HTMLElement {
  const listId = `tag-suggestions-${++ids}`;
  let active = -1;
  let suggestions: string[] = [];

  const add = (raw: string) => {
    const tag = cleanTag(raw);
    o.onDraft('');
    if (tag && !o.tags.includes(tag)) o.onChange([...o.tags, tag]);
    else input.value = '';
  };
  const remove = (tag: string) => o.onChange(o.tags.filter((t) => t !== tag));

  const chips = o.tags.map((tag) => {
    const x = h(
      'button',
      { type: 'button', 'aria-label': `Remove the tag ${tag}`, title: 'Remove' },
      ICONS.x(),
    );
    x.onclick = () => remove(tag);
    return h('span', { class: 'chip' }, `#${tag}`, x);
  });

  const input = h('input', {
    type: 'text',
    value: o.draft,
    placeholder: o.tags.length ? 'Add another' : 'Add a tag',
    'aria-label': 'Add a tag',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-controls': listId,
    'aria-expanded': 'false',
    autocomplete: 'off',
    spellcheck: false,
    maxlength: 40,
  });
  const listbox = h('ul', { class: 'suggestions', id: listId, role: 'listbox' });

  const suggest = () => {
    const typed = cleanTag(input.value);
    suggestions = o.known
      .filter((t) => !o.tags.includes(t) && t.includes(typed))
      // Ones that start with what's typed first.
      .sort((a, b) => +!a.startsWith(typed) - +!b.startsWith(typed))
      .slice(0, SUGGESTIONS);
    active = Math.min(active, suggestions.length - 1);
    listbox.replaceChildren(
      ...suggestions.map((tag, i) => {
        const option = h(
          'li',
          { role: 'option', id: `${listId}-${i}`, 'aria-selected': `${i === active}` },
          `#${tag}`,
        );
        // Before the field loses focus, which would close the editor.
        option.onmousedown = (e) => e.preventDefault();
        option.onclick = () => add(tag);
        return option;
      }),
    );
    const open = suggestions.length > 0 && document.activeElement === input;
    const opening = open && listbox.hidden;
    listbox.hidden = !open;
    input.setAttribute('aria-expanded', `${open}`);
    // Near the bottom of the sidebar, the suggestions would open out of sight.
    if (opening) listbox.scrollIntoView({ block: 'nearest' });
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  input.oninput = () => {
    // A comma ends a tag, as in most tag fields. Spaces join words: `reading list`.
    if (input.value.endsWith(',')) return add(input.value);
    active = -1;
    o.onDraft(input.value);
    suggest();
  };
  input.onfocus = suggest;
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = suggestions.length;
      if (!n) return;
      active = e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n;
      suggest();
    } else if (e.key === 'Enter' || (e.key === 'Tab' && input.value.trim())) {
      e.preventDefault();
      const picked = suggestions[active];
      if (picked) add(picked);
      else if (input.value.trim()) add(input.value);
      else o.onClose();
    } else if (e.key === 'Backspace' && !input.value && o.tags.length) {
      remove(o.tags.at(-1)!);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      o.onDraft('');
      o.onClose();
    }
  };

  const field = h('div', { class: 'tag-editor' }, ...chips, input, listbox);
  field.onclick = (e) => e.target === field && input.focus();
  // Leaving the field adds what's typed and closes it. Updates rebuild it, which isn't leaving.
  field.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!field.isConnected || field.contains(document.activeElement)) return;
      if (input.value.trim()) add(input.value);
      o.onClose();
    });
  });
  listbox.hidden = true;
  return field;
}
