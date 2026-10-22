import type { Annotation } from 'penciled/headless';
import { BackupError, bySite, createBackup, restoreBackup, toMarkdown } from '../../lib/backup.ts';
import { h } from '../../lib/dom.ts';
import { deleteAnnotation, listPages, openAnnotation, type Page } from '../../lib/pages.ts';
import { highlight } from '../../lib/scheme.ts';
import { formatQuery, parseQuery, search } from '../../lib/search.ts';
import { getSettings } from '../../lib/settings.ts';
import { tagsOf } from '../../lib/tags.ts';
import { plural } from './settings.ts';

const dark = matchMedia('(prefers-color-scheme: dark)').matches;

// Kept across renders, which happen whenever a tab changes a highlight.
let query = '';
let status = '';

function download(name: string, type: string, text: string) {
  const link = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);

/** The notes tab: every highlight, from every site. */
export async function notesView(rerender: () => void): Promise<Node[]> {
  const [pages, { colors }] = await Promise.all([listPages(), getSettings()]);
  const total = pages.reduce((n, p) => n + p.annotations.length, 0);

  const setStatus = (text: string) => {
    status = text;
    rerender();
  };

  const exportJson = h('button', { type: 'button', disabled: !total }, 'Export a backup');
  exportJson.onclick = async () =>
    download(
      `penciled-${today()}.json`,
      'application/json',
      JSON.stringify(await createBackup(), null, 2),
    );
  const exportMarkdown = h('button', { type: 'button', disabled: !total }, 'Export as Markdown');
  exportMarkdown.onclick = () =>
    download(`penciled-${today()}.md`, 'text/markdown', toMarkdown(pages));
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  file.onchange = async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      const added = await restoreBackup(JSON.parse(await chosen.text()));
      setStatus(
        added
          ? `Imported ${plural(added, 'highlight')}.`
          : 'Everything in this backup is already here.',
      );
    } catch (e) {
      setStatus(e instanceof BackupError ? e.message : 'This file isn’t a penciled backup.');
    }
  };
  const importJson = h('button', { type: 'button' }, 'Import a backup');
  importJson.onclick = () => file.click();

  const results = h('div', { class: 'results' });
  const search = h('input', {
    type: 'search',
    id: 'search',
    value: query,
    placeholder: 'Search highlights, notes and #tags',
    'aria-label': 'Search highlights and notes',
    disabled: !total,
  });
  const showResults = () => results.replaceChildren(...list(pages, colorOf, rerender));
  search.oninput = () => {
    query = search.value;
    showResults();
  };
  const colorOf = (id: string) => colors.find((c) => c.id === id)?.value;
  showResults();

  return [
    h(
      'div',
      { class: 'notice' },
      h(
        'p',
        {},
        'Your highlights are saved only in this browser. Uninstalling penciled deletes them, so export a backup now and then.',
      ),
      h('div', { class: 'actions' }, exportJson, exportMarkdown, importJson, file),
      h('p', { role: 'status', class: 'hint' }, status),
    ),
    search,
    results,
  ];
}

function list(
  pages: Page[],
  colorOf: (id: string) => string | undefined,
  rerender: () => void,
): Node[] {
  if (!pages.length) {
    return [
      h(
        'p',
        { class: 'empty' },
        'Nothing highlighted yet. Select text on any page to highlight it, and it shows up here.',
      ),
    ];
  }
  const shown = search(pages, query);
  if (!shown.length) return [h('p', { class: 'empty' }, `Nothing matches “${query.trim()}”.`)];

  const item = (page: Page, a: Annotation) => {
    const dot = h('span', { class: 'dot', 'aria-hidden': 'true' });
    const value = colorOf(a.color);
    if (value) dot.style.background = highlight(value, dark);
    const open = h('button', { type: 'button', class: 'link' }, 'Open');
    open.onclick = () => openAnnotation(page, a.id);
    const remove = h('button', { type: 'button', class: 'link' }, 'Delete');
    remove.onclick = async () => {
      await deleteAnnotation(page, a.id);
      rerender();
    };
    return h(
      'li',
      { class: 'item' },
      dot,
      h(
        'span',
        { class: 'body' },
        h('span', {}, a.quote),
        a.note && h('span', { class: 'note' }, a.note),
        tagsOf(a).length > 0 &&
          h(
            'span',
            { class: 'tags' },
            ...tagsOf(a).map((tag) => {
              const chip = h(
                'button',
                { type: 'button', class: 'chip', title: `Show only #${tag}` },
                `#${tag}`,
              );
              chip.onclick = () => {
                const q = parseQuery(query);
                if (!q.tags.includes(tag)) query = formatQuery({ ...q, tags: [...q.tags, tag] });
                rerender();
              };
              return chip;
            }),
          ),
      ),
      h('span', { class: 'actions' }, open, remove),
    );
  };

  return [...bySite(shown)].map(([site, list]) =>
    h(
      'section',
      { class: 'site' },
      h('h2', {}, site),
      ...list.map((page) =>
        h(
          'article',
          { class: 'page' },
          h(
            'h3',
            {},
            h('a', { href: page.url, target: '_blank', rel: 'noreferrer' }, page.title || page.url),
          ),
          h('ul', { class: 'items' }, ...page.annotations.map((a) => item(page, a))),
        ),
      ),
    ),
  );
}
