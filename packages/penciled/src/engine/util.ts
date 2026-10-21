import type { Annotation } from './types.ts';

declare const process: { env: { NODE_ENV?: string } };

/** True in development builds. Bundlers replace `process.env.NODE_ENV`; unbundled code is quiet. */
export function dev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

export const now = (): string => new Date().toISOString();

export function warn(message: string): void {
  console.warn(`[penciled] ${message}`);
}

/** `crypto.randomUUID()` only exists in secure contexts, so plain-HTTP pages get a fallback. */
export function uuid(): string {
  return (
    crypto.randomUUID?.() ??
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (+c / 4)))).toString(16),
    )
  );
}

export interface Emitter<E> {
  on<K extends keyof E>(event: K, listener: E[K]): () => void;
  emit<K extends keyof E>(
    event: K,
    ...args: E[K] extends (...a: infer A) => void ? A : never
  ): void;
  has(event: keyof E): boolean;
  clear(): void;
}

export function emitter<E>(): Emitter<E> {
  const listeners = new Map<keyof E, Set<E[keyof E]>>();
  return {
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      listeners.set(event, set.add(listener));
      return () => void set.delete(listener);
    },
    emit(event, ...args) {
      for (const fn of [...(listeners.get(event) ?? [])]) {
        try {
          (fn as (...a: unknown[]) => void)(...args);
        } catch (e) {
          // A throwing listener must not break the engine or other listeners.
          console.error(e);
        }
      }
    },
    has: (event) => !!listeners.get(event)?.size,
    clear: () => listeners.clear(),
  };
}

/**
 * Checks and upgrades an annotation read from storage or a file: fills defaults, drops unknown
 * fields and migrates older versions. Returns `undefined` for data that isn't an annotation.
 * Annotations without a color get `color`.
 */
export function normalize(data: unknown, color = 'yellow'): Annotation | undefined {
  const a = data as Partial<Annotation> | undefined;
  if (typeof a?.quote !== 'string' || (a.version ?? 1) !== 1) return;
  const at = now();
  return {
    version: 1,
    id: a.id || uuid(),
    quote: a.quote,
    prefix: a.prefix ?? '',
    suffix: a.suffix ?? '',
    start: a.start ?? 0,
    end: a.end ?? 0,
    color: a.color || color,
    ...(a.note && { note: a.note }),
    ...(a.editable !== undefined && { editable: a.editable }),
    ...(a.meta && { meta: a.meta }),
    createdAt: a.createdAt || at,
    updatedAt: a.updatedAt || a.createdAt || at,
  };
}
