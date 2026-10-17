import { type Annotator, annotate, type SelectContext, toW3C } from '../src/headless.ts';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector(selector) as T;
const article = $<HTMLElement>('#article');
const list = $<HTMLDivElement>('#list');
const log = $<HTMLPreElement>('#log');
const note = $<HTMLTextAreaElement>('#note');

let instance: Annotator;
let selected: SelectContext | null = null;

function print(event: string, payload: unknown) {
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()} ${event} ${JSON.stringify(
    payload,
    (k, v) => (k === 'range' ? `Range("${v}")` : v),
  )}`;
  log.prepend(line);
}

function renderList() {
  list.replaceChildren(
    ...instance.getAll().map((a) => {
      const item = document.createElement('div');
      const orphan = !instance.getRange(a.id);
      item.className = orphan ? 'orphan' : '';
      item.textContent = `${orphan ? '⚠ orphan · ' : ''}${a.color}: “${a.quote}”${a.note ? ` — ${a.note}` : ''}`;
      item.onclick = () => instance.focus(a.id);
      return item;
    }),
  );
}

function start(readOnly: boolean) {
  instance?.destroy();
  instance = annotate(article, { documentId: 'playground', readOnly, noteIndicator: 'underline' });
  for (const event of [
    'create',
    'update',
    'delete',
    'orphan',
    'load',
    'error',
    'select',
  ] as const) {
    instance.on(event, (payload: unknown) => {
      print(event, payload);
      renderList();
    });
  }
  instance.on('select', (ctx) => {
    selected = ctx;
    const editable = !!ctx?.annotation && ctx.editable;
    note.disabled = !editable;
    note.value = ctx?.annotation?.note ?? '';
    $<HTMLButtonElement>('#save-note').disabled = !editable;
    $<HTMLButtonElement>('#remove').disabled = !editable;
  });
  Object.assign(window, { penciled: instance });
}

// Keep the selection when clicking the panel's buttons.
document.querySelector('aside')!.addEventListener('pointerdown', (e) => {
  if ((e.target as Element).closest('button')) e.preventDefault();
});
document.querySelector('aside')!.setAttribute('data-penciled', '');

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-color]')) {
  button.onclick = () => {
    const color = button.dataset.color!;
    if (selected?.annotation) instance.update(selected.annotation.id, { color });
    else if (selected) instance.create(selected.range, { color });
    getSelection()?.removeAllRanges();
  };
}

$<HTMLButtonElement>('#save-note').onclick = () => {
  if (selected?.annotation) instance.update(selected.annotation.id, { note: note.value });
};
$<HTMLButtonElement>('#remove').onclick = () => {
  if (selected?.annotation) instance.remove(selected.annotation.id);
};
$<HTMLButtonElement>('#refresh').onclick = () => instance.refresh();
$<HTMLButtonElement>('#clear').onclick = () => instance.clear();
$<HTMLButtonElement>('#export').onclick = () => {
  const data = JSON.stringify(instance.export(), null, 2);
  navigator.clipboard?.writeText(data);
  print('export (copied)', instance.export());
};
$<HTMLButtonElement>('#import').onclick = () => {
  const data = prompt('Paste export() JSON');
  if (data) instance.import(JSON.parse(data));
};
$<HTMLButtonElement>('#w3c').onclick = () => print('toW3C', toW3C(instance.getAll()));
$<HTMLInputElement>('#readonly').onchange = (e) => start((e.target as HTMLInputElement).checked);

// Simulates content changing under the annotations: edits, inserts and moves paragraphs.
let step = 0;
$<HTMLButtonElement>('#mutate').onclick = () => {
  const paragraphs = article.querySelectorAll('p');
  const changes = [
    () =>
      article.querySelector('h1')!.after(
        Object.assign(document.createElement('p'), {
          textContent: 'An inserted paragraph pushes everything down.',
        }),
      ),
    () => article.append(paragraphs[0]!),
    () => {
      const p = paragraphs[1]!;
      p.innerHTML = p.innerHTML.replace('truly marvelous', 'truly <b>remarkable</b>');
    },
    () => {
      article.innerHTML = article.innerHTML.replace(/\n\s+/g, ' ');
    },
  ];
  changes[step++ % changes.length]!();
  print('mutate', `change #${((step - 1) % changes.length) + 1}`);
};

start(false);
