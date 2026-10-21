import '../../assets/ui.css';
import { browser } from 'wxt/browser';
import { h } from '../../lib/dom.ts';
import { ask, type Item, type PageState } from '../../lib/messages.ts';
import { highlight } from '../../lib/scheme.ts';

const app = document.getElementById('app')!;
const dark = matchMedia('(prefers-color-scheme: dark)').matches;

/** The tab to show: the active one, or the one named in `?tab=`, which tests open in a tab. */
async function target(): Promise<number | undefined> {
  const named = Number(new URLSearchParams(location.search).get('tab'));
  if (named) return named;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function shortcut(): Promise<string> {
  const commands = await browser.commands.getAll();
  return commands.find((c) => c.name === 'toggle')?.shortcut || 'the shortcut';
}

const settingsButton = () => {
  const button = h(
    'button',
    { type: 'button', class: 'icon', 'aria-label': 'Settings', title: 'Settings' },
    '⚙',
  );
  button.onclick = () => browser.runtime.openOptionsPage();
  return button;
};

function render(tab: number, state: PageState, keys: string) {
  const swatch = (color: string) => {
    const c = state.colors.find((c) => c.id === color);
    const dot = h('span', { class: 'dot', 'aria-hidden': 'true' });
    if (c) dot.style.background = highlight(c.value, dark);
    return dot;
  };

  const item = (a: Item) => {
    const quote = h('span', { class: 'quote' }, a.quote);
    const note = a.note && h('span', { class: 'note' }, a.note);
    if (a.orphan) {
      const remove = h('button', { type: 'button', class: 'link' }, 'Delete');
      remove.onclick = async () => render(tab, await ask(tab, { type: 'remove', id: a.id }), keys);
      return h(
        'li',
        { class: 'orphan' },
        h(
          'div',
          { class: 'item' },
          swatch(a.color),
          h(
            'span',
            { class: 'body' },
            quote,
            note,
            h('span', { class: 'hint' }, 'Couldn’t find this on the page.'),
          ),
          remove,
        ),
      );
    }
    const open = h(
      'button',
      { type: 'button', class: 'item' },
      swatch(a.color),
      h('span', { class: 'body' }, quote, note),
    );
    open.onclick = async () => {
      await ask(tab, { type: 'focus', id: a.id });
      window.close();
    };
    return h('li', {}, open);
  };

  const enabled = h('input', { type: 'checkbox', role: 'switch', checked: !state.disabled });
  enabled.onchange = async () =>
    render(tab, await ask(tab, { type: 'site', enabled: enabled.checked }), keys);

  const body = state.disabled
    ? h('p', { class: 'empty' }, `penciled is off on ${state.site}. Your highlights are kept.`)
    : state.hidden
      ? h('p', { class: 'empty' }, `Highlights are hidden on this tab. Press ${keys} to show them.`)
      : state.items.length
        ? h('ul', { class: 'items' }, ...state.items.map(item))
        : h(
            'p',
            { class: 'empty' },
            'Nothing highlighted on this page yet. Select some text to start.',
          );

  app.replaceChildren(
    h(
      'header',
      {},
      h('label', { class: 'switch' }, enabled, h('span', {}, 'On ', h('strong', {}, state.site))),
      settingsButton(),
    ),
    body,
  );
}

async function main() {
  const tab = await target();
  try {
    if (!tab) throw new Error('No tab');
    render(tab, await ask(tab, { type: 'state' }), await shortcut());
  } catch {
    // The browser's own pages, the extension store, or a tab opened before penciled was installed.
    app.replaceChildren(
      h('header', {}, h('span', {}, 'penciled'), settingsButton()),
      h(
        'p',
        { class: 'empty' },
        'penciled can’t run on this page. If it was open before penciled was installed, reload it.',
      ),
    );
  }
}

main();
