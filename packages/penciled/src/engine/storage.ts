import type { Annotation, AnnotationStorage } from './types.ts';

// Stores `{ version, annotations }` as JSON under `penciled:<documentId>`.
export function localStorageAdapter(): AnnotationStorage {
  const key = (documentId: string) => `penciled:${documentId}`;
  return {
    async load(documentId) {
      const raw = localStorage.getItem(key(documentId));
      return raw ? (JSON.parse(raw).annotations ?? []) : [];
    },
    // Writes synchronously before the promise settles, so a flush on `pagehide` lands in time.
    async save(documentId, annotations) {
      localStorage.setItem(key(documentId), JSON.stringify({ version: 1, annotations }));
    },
  };
}

export function memoryAdapter(): AnnotationStorage {
  return { load: async () => [], save: async () => {} };
}

type Op = 'create' | 'update' | 'delete';

export interface Persister {
  queue(op: Op, id: string): void;
  // Writes pending changes now. Does nothing until `start()` is called.
  flush(): void;
  // Called once stored data has loaded: writing earlier could overwrite it.
  start(): void;
}

/**
 * Batches writes for `delay` ms. Repeated changes to one annotation collapse into one call
 * (create then update is a create; create then delete is nothing). Failures go to `onError`.
 */
export function persister(
  storage: AnnotationStorage,
  documentId: string,
  snapshot: () => Annotation[],
  onError: (error: unknown) => void,
  delay: number,
): Persister {
  const pending = new Map<string, Op>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let started = false;

  const run = (write: () => Promise<void> | undefined) => {
    try {
      write()?.catch(onError);
    } catch (e) {
      onError(e);
    }
  };

  const flush = () => {
    clearTimeout(timer);
    if (!started || !pending.size) return;
    const annotations = snapshot();
    const byId = new Map(annotations.map((a) => [a.id, a]));
    let save = false;
    for (const [id, op] of pending) {
      const annotation = byId.get(id);
      if (op === 'delete' && storage.delete) run(() => storage.delete!(documentId, id));
      else if (op !== 'delete' && storage[op] && annotation) {
        run(() => storage[op]!(documentId, annotation));
      } else save = true;
    }
    pending.clear();
    if (save) run(() => storage.save(documentId, annotations));
  };

  return {
    queue(op, id) {
      const prev = pending.get(id);
      if (prev === 'create' && op === 'delete') pending.delete(id);
      else if (prev === 'delete' && op === 'create') pending.set(id, 'update');
      else if (prev !== 'create') pending.set(id, op);
      if (delay > 0) {
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
      } else flush();
    },
    flush,
    start() {
      started = true;
      flush();
    },
  };
}
