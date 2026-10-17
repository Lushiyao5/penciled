import '../src/styles.css';
import {
  type Action,
  type AnnotateOptions,
  type Annotator,
  annotate,
  type BuiltInAction,
  type Placement,
  type Theme,
} from '../src/index.ts';

const form = document.querySelector<HTMLFormElement>('#options')!;
const code = document.querySelector<HTMLPreElement>('#code')!;
let instance: Annotator | undefined;

const SHARE: Action = {
  id: 'share',
  label: 'Share',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>',
  onSelect: (ctx) => console.log('share', ctx.text, ctx.annotation),
};

// Options as read from the form, plus the source shown in the panel.
function read(): { options: AnnotateOptions; source: Record<string, unknown> } {
  const data = new FormData(form);
  const on = (name: string) => data.has(name);
  const value = (name: string) => `${data.get(name) ?? ''}`;
  const actions = (['highlight', 'note', 'copy', 'remove'] as BuiltInAction[]).filter(on);
  const max = Number(value('maxNoteLength'));
  const options: AnnotateOptions = {
    documentId: 'ui-playground',
    theme: value('theme') as Theme,
    noteIndicator: on('noteIndicator') && 'underline',
    notePreview: on('notePreview') && 'hover',
    readOnly: on('readOnly'),
    shortcuts: on('shortcuts') && {},
    placement: {
      toolbar: value('toolbar') as Placement | 'auto',
      editor: value('editor') as Placement,
      preview: value('preview') as Placement,
    },
    actions: on('share') ? [...actions, SHARE] : actions,
    ...(max > 0 && { maxNoteLength: max }),
    ...(on('mint') && {
      colors: [
        'yellow',
        'green',
        'blue',
        'pink',
        'purple',
        { name: 'mint', light: '#5eead480', dark: '#2dd4bf47' },
      ],
    }),
  };
  const source = {
    ...options,
    shortcuts: on('shortcuts') ? undefined : false,
    actions: on('share') ? [...actions, 'SHARE'] : actions,
  };
  return { options, source };
}

// The annotate() call for the current options, roughly as you'd write it.
function show(source: Record<string, unknown>) {
  code.textContent = `annotate('#article', ${JSON.stringify(source, null, 2)
    .replace(/"([a-zA-Z]+)":/g, '$1:')
    .replace(/"/g, "'")
    .replace("'SHARE'", "{ id: 'share', label: 'Share', icon, onSelect }")});`;
}

function applyScheme(theme: Theme) {
  // Highlights follow the page's color-scheme; the UI follows `theme`.
  document.documentElement.style.colorScheme = theme === 'auto' ? 'light dark' : theme;
}

function start() {
  const { options, source } = read();
  instance?.destroy();
  instance = annotate('#article', options);
  Object.assign(window, { penciled: instance });
  applyScheme(options.theme!);
  show(source);
}

form.onchange = (e) => {
  // Theme applies live through setTheme(), without rebuilding the instance.
  if ((e.target as HTMLElement).getAttribute('name') !== 'theme') return start();
  const { options, source } = read();
  instance!.setTheme(options.theme!);
  applyScheme(options.theme!);
  show(source);
};
form.oninput = (e) => {
  if ((e.target as HTMLElement).getAttribute('name') === 'maxNoteLength') start();
};
document.querySelector<HTMLButtonElement>('#clear')!.onclick = () => instance?.clear();
document.querySelector<HTMLButtonElement>('#export')!.onclick = () =>
  console.log(instance?.export());
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => {
  form.reset();
  start();
};

start();
