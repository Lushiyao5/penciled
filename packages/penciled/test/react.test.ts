import { act, createElement, StrictMode, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { Annotatable, type Annotator, useAnnotations } from '../src/react/index.ts';
import { cleanup, find, painted, wait } from './helpers.ts';

// Tells React that `act()` is available.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  cleanup();
});

function render(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(createElement(StrictMode, null, element)));
  return host;
}

test('<Annotatable> survives re-renders, so the host DOM is never modified', async () => {
  let instance: Annotator | null = null;
  let bump = () => {};
  const errors = vi.spyOn(console, 'error');
  function App() {
    const [count, setCount] = useState(0);
    bump = () => setCount((c) => c + 1);
    return createElement(
      Annotatable,
      {
        as: 'article',
        className: 'post',
        options: { storage: 'memory', documentId: 'react' },
        instanceRef: (i: Annotator | null) => {
          instance = i;
        },
      },
      createElement('p', null, 'The quick brown fox jumps over the lazy dog.'),
      createElement('p', null, `Rendered ${count} times`),
    );
  }
  const host = render(createElement(App));
  const article = host.querySelector('article.post')!;
  expect(instance).not.toBeNull();
  await instance!.ready;
  const a = instance!.create(find(article, 'brown fox'))!;

  for (let i = 0; i < 3; i++) act(bump);
  await wait(200);
  expect(article.textContent).toContain('Rendered 3 times');
  expect(instance!.getRange(a.id)?.toString()).toBe('brown fox');
  expect(painted('penciled-yellow')).toEqual(['brown fox']);
  expect(errors).not.toHaveBeenCalled();

  act(() => root!.unmount());
  root = undefined;
  expect(instance).toBeNull();
  expect(CSS.highlights.has('penciled-yellow')).toBe(false);
});

test('useAnnotations calls the latest callbacks and applies theme changes live', async () => {
  const calls: string[] = [];
  let instance: Annotator | null = null;
  let setLabel = (_: string) => {};
  let setTheme = (_: 'light' | 'dark') => {};
  function App() {
    const ref = useRef<HTMLDivElement>(null);
    const [label, set] = useState('first');
    const [theme, setT] = useState<'light' | 'dark'>('light');
    setLabel = set;
    setTheme = setT;
    instance = useAnnotations(ref, {
      storage: 'memory',
      documentId: 'hook',
      theme,
      onCreate: () => calls.push(label),
    });
    return createElement('div', { ref }, 'Some text to highlight.');
  }
  const host = render(createElement(App));
  const created = instance!;
  act(() => setLabel('second'));
  expect(instance).toBe(created);
  instance!.create(find(host, 'text'));
  expect(calls).toEqual(['second']);

  const setThemeSpy = vi.spyOn(created, 'setTheme');
  act(() => setTheme('dark'));
  expect(setThemeSpy).toHaveBeenCalledWith('dark');
  expect(instance).toBe(created);
});

test('a route change with a new documentId swaps the instance and its annotations', async () => {
  const storage = 'local' as const;
  let navigate = (_: string) => {};
  let instance: Annotator | null = null;
  function Page() {
    const [route, setRoute] = useState('one');
    navigate = setRoute;
    return createElement(
      Annotatable,
      {
        options: { storage, documentId: route, saveDelay: 0 },
        instanceRef: (i: Annotator | null) => {
          instance = i;
        },
      },
      createElement('p', null, `Page ${route}: the quick brown fox.`),
    );
  }
  const host = render(createElement(Page));
  await instance!.ready;
  instance!.create(find(host, 'quick'));
  expect(painted('penciled-yellow')).toEqual(['quick']);

  act(() => navigate('two'));
  await instance!.ready;
  expect(instance!.documentId).toBe('two');
  expect(instance!.getAll()).toEqual([]);
  expect(CSS.highlights.has('penciled-yellow')).toBe(false);

  act(() => navigate('one'));
  await instance!.ready;
  expect(instance!.getAll().map((a) => a.quote)).toEqual(['quick']);
  expect(painted('penciled-yellow')).toEqual(['quick']);
});
