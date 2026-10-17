import {
  createElement,
  type HTMLAttributes,
  type ReactElement,
  type Ref,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { annotate } from '../ui/annotate.ts';
import type { AnnotateOptions, Annotator } from '../ui/types.ts';

export type { AnnotateOptions, Annotator } from '../ui/types.ts';

const CALLBACKS = [
  'onCreate',
  'onUpdate',
  'onDelete',
  'onOrphan',
  'onLoad',
  'onError',
  'onSelect',
] as const;

/**
 * Annotates the element in `ref` while the component is mounted, and returns the instance (`null`
 * until then). The instance is recreated when `documentId` or `readOnly` changes, `theme` applies
 * live and the `on…` callbacks always call their latest version. Other options are read once.
 */
export function useAnnotations(
  ref: RefObject<Element | null>,
  options: AnnotateOptions = {},
): Annotator | null {
  const [instance, setInstance] = useState<Annotator | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: these options recreate the instance.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const callbacks: Record<string, (arg: unknown) => void> = {};
    for (const name of CALLBACKS) {
      callbacks[name] = (arg) => {
        const fn = latest.current[name] ?? (name === 'onError' ? console.error : undefined);
        (fn as ((arg: unknown) => void) | undefined)?.(arg);
      };
    }
    const created = annotate(el, { ...latest.current, ...callbacks });
    setInstance(created);
    return () => {
      created.destroy();
      setInstance(null);
    };
  }, [ref, options.documentId, options.readOnly]);
  useEffect(() => {
    instance?.setTheme(options.theme ?? 'auto');
  }, [instance, options.theme]);
  return instance;
}

export interface AnnotatableProps extends HTMLAttributes<HTMLElement> {
  /** The element to render. Defaults to `div`. */
  as?: keyof HTMLElementTagNameMap;
  options?: AnnotateOptions;
  /** Receives the instance, or `null` before it is created and after it is destroyed. */
  instanceRef?: Ref<Annotator | null>;
}

/** Renders `children` in an element with highlights and notes enabled. */
export function Annotatable({
  as = 'div',
  options,
  instanceRef,
  ...props
}: AnnotatableProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  const instance = useAnnotations(ref, options);
  useImperativeHandle<Annotator | null, Annotator | null>(instanceRef, () => instance, [instance]);
  return createElement(as, { ...props, ref });
}
