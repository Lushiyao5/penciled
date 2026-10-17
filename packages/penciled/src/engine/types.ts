/** A single highlight, optionally with a note. */
export interface Annotation {
  version: 1;
  id: string;
  /** Exact selected text, with whitespace runs collapsed to single spaces. */
  quote: string;
  /** Text immediately before the quote, used to re-anchor. */
  prefix: string;
  /** Text immediately after the quote, used to re-anchor. */
  suffix: string;
  /** Start offset in the container's whitespace-collapsed text. */
  start: number;
  /** End offset in the container's whitespace-collapsed text. */
  end: number;
  color: string;
  note?: string;
  editable?: boolean;
  meta?: Record<string, unknown>;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
}

/** Persistence adapter. Granular methods, when present, are used instead of `save`. */
export interface AnnotationStorage {
  load(documentId: string): Promise<Annotation[]>;
  save(documentId: string, annotations: Annotation[]): Promise<void>;
  create?(documentId: string, annotation: Annotation): Promise<void>;
  update?(documentId: string, annotation: Annotation): Promise<void>;
  delete?(documentId: string, id: string): Promise<void>;
}

/** Fields that can be set when creating an annotation. */
export interface AnnotationInit {
  color?: string;
  note?: string;
  editable?: boolean;
  meta?: Record<string, unknown>;
}

/** Fields that can be changed on an existing annotation. A `null` or empty note removes it. */
export interface AnnotationPatch {
  color?: string;
  note?: string | null;
  editable?: boolean;
  meta?: Record<string, unknown>;
}

/** What the reader is pointing at: a fresh selection, or an existing annotation. */
export interface SelectContext {
  /** The selected or annotated text. */
  text: string;
  range: Range;
  /** Set when the reader clicked an annotation or selected exactly its text. */
  annotation?: Annotation;
  /** Whether the UI may offer editing actions (false in `readOnly` or for `editable: false`). */
  editable: boolean;
}

export interface ExportData {
  version: 1;
  documentId: string;
  annotations: Annotation[];
}

export interface ImportOptions {
  /** `merge` (default) upserts by `id`, incoming wins; `replace` also removes everything else. */
  mode?: 'merge' | 'replace';
}

export interface AnnotatorEvents {
  create: (annotation: Annotation) => void;
  update: (annotation: Annotation) => void;
  delete: (annotation: Annotation) => void;
  /** The annotation's text can no longer be found with confidence. It stays in the API. */
  orphan: (annotation: Annotation) => void;
  /** Stored annotations were loaded and anchored. */
  load: (annotations: Annotation[]) => void;
  /** A persistence failure. The annotations in memory are unaffected. */
  error: (error: unknown) => void;
  /** The reader selected text or an annotation; `null` when that selection is dismissed. */
  select: (context: SelectContext | null) => void;
}

export interface AnnotateOptions {
  /** Scopes stored annotations. Defaults to the pathname, plus the container's id or index. */
  documentId?: string;
  /** Defaults to `'local'` (localStorage). `'memory'` keeps nothing across reloads. */
  storage?: 'local' | 'memory' | AnnotationStorage;
  /** Milliseconds to batch writes. `0` writes immediately. Defaults to 300. */
  saveDelay?: number;
  /** Configured color names. Defaults to yellow, green, blue, pink and purple. */
  colors?: string[];
  /** Color for new annotations and for annotations whose color is no longer configured. */
  defaultColor?: string;
  /** Readers can open existing annotations but not create or edit them. */
  readOnly?: boolean;
  /** `'underline'` paints annotations with a note in a separate `-noted` highlight. */
  noteIndicator?: 'underline' | false;
  /** Re-anchor when the container's content changes. Defaults to true. */
  observe?: boolean;
  onCreate?: AnnotatorEvents['create'];
  onUpdate?: AnnotatorEvents['update'];
  onDelete?: AnnotatorEvents['delete'];
  onOrphan?: AnnotatorEvents['orphan'];
  onLoad?: AnnotatorEvents['load'];
  onError?: AnnotatorEvents['error'];
  onSelect?: AnnotatorEvents['select'];
}

export interface Annotator {
  readonly documentId: string;
  readonly container: Element;
  /** Resolves once stored annotations have been loaded and anchored. */
  readonly ready: Promise<void>;
  /**
   * Annotates `range` (clamped to the container). Returns the existing annotation when one covers
   * exactly the same text, and `undefined` when the range holds no text.
   */
  create(range: Range, init?: AnnotationInit): Annotation | undefined;
  get(id: string): Annotation | undefined;
  /** Every annotation in document order, including orphans. */
  getAll(): Annotation[];
  /** The annotation's current range, or `null` if it is orphaned or unknown. */
  getRange(id: string): Range | null;
  update(id: string, patch: AnnotationPatch): Annotation | undefined;
  remove(id: string): void;
  clear(): void;
  /** Scrolls to the annotation, marks it active and emits `select`. */
  focus(id: string): void;
  /** Dismisses the current selection or annotation, emitting `select` with `null`. */
  blur(): void;
  /** The innermost annotation painted at the viewport point (x, y), e.g. under the pointer. */
  annotationAt(x: number, y: number): Annotation | undefined;
  /** Re-anchors every annotation against the current content. */
  refresh(): void;
  export(): ExportData;
  /** Adds annotations from `export()` data (or a bare array) and re-anchors them. */
  import(data: ExportData | Annotation[], options?: ImportOptions): void;
  on<K extends keyof AnnotatorEvents>(event: K, listener: AnnotatorEvents[K]): () => void;
  /** Removes every listener, observer and highlight, and flushes pending writes. */
  destroy(): void;
}
