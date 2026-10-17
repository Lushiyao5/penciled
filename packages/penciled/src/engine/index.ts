export { annotate } from './annotate.ts';
export type {
  AnnotateOptions,
  Annotation,
  AnnotationInit,
  AnnotationPatch,
  AnnotationStorage,
  Annotator,
  AnnotatorEvents,
  ExportData,
  ImportOptions,
  SelectContext,
} from './types.ts';
export type { W3CAnnotation, W3CBody, W3CSelector, W3CTarget } from './w3c.ts';
export { fromW3C, toW3C } from './w3c.ts';
