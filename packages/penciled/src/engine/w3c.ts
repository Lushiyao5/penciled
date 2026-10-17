import type { Annotation } from './types.ts';
import { normalize } from './util.ts';

/** The subset of the W3C Web Annotation model that penciled reads and writes. */
export interface W3CAnnotation {
  '@context'?: string | string[];
  id?: string;
  type?: string;
  motivation?: string | string[];
  created?: string;
  modified?: string;
  body?: W3CBody | W3CBody[];
  target: W3CTarget | W3CTarget[];
  /** penciled-specific fields, so a round trip is lossless. Other tools ignore them. */
  penciled?: { color?: string; editable?: boolean; meta?: Record<string, unknown> };
}

export interface W3CBody {
  type?: string;
  value?: string;
  purpose?: string;
  format?: string;
}

export interface W3CTarget {
  source?: string;
  selector?: W3CSelector | W3CSelector[];
}

export type W3CSelector =
  | { type: 'TextQuoteSelector'; exact: string; prefix?: string; suffix?: string }
  | { type: 'TextPositionSelector'; start: number; end: number }
  | { type: string };

const list = <T>(x: T | T[] | undefined): T[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];

/**
 * Converts annotations to W3C Web Annotations with a TextQuoteSelector and a TextPositionSelector.
 * Offsets and quotes are in penciled's whitespace-collapsed text, counted in UTF-16 code units.
 */
export function toW3C(
  annotations: Annotation[],
  options: { source?: string } = {},
): W3CAnnotation[] {
  const source = options.source ?? (typeof location === 'undefined' ? undefined : location.href);
  return annotations.map((a) => ({
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    id: `urn:uuid:${a.id}`,
    type: 'Annotation',
    motivation: a.note ? 'commenting' : 'highlighting',
    created: a.createdAt,
    modified: a.updatedAt,
    ...(a.note && {
      body: { type: 'TextualBody', value: a.note, purpose: 'commenting', format: 'text/plain' },
    }),
    target: {
      ...(source && { source }),
      selector: [
        { type: 'TextQuoteSelector', exact: a.quote, prefix: a.prefix, suffix: a.suffix },
        { type: 'TextPositionSelector', start: a.start, end: a.end },
      ],
    },
    penciled: {
      color: a.color,
      ...(a.editable !== undefined && { editable: a.editable }),
      ...(a.meta && { meta: a.meta }),
    },
  }));
}

/**
 * Converts W3C Web Annotations back. Items without a TextQuoteSelector are skipped. Annotations
 * without a penciled color get `options.color` (default `"yellow"`).
 */
export function fromW3C(
  items: W3CAnnotation | W3CAnnotation[],
  options: { color?: string } = {},
): Annotation[] {
  const out: Annotation[] = [];
  for (const item of list(items)) {
    const selectors = list(item.target).flatMap((t) => list(t?.selector));
    const quote = selectors.find((s) => s.type === 'TextQuoteSelector') as
      | { exact: string; prefix?: string; suffix?: string }
      | undefined;
    if (typeof quote?.exact !== 'string') continue;
    const position = selectors.find((s) => s.type === 'TextPositionSelector') as
      | { start: number; end: number }
      | undefined;
    const note = list(item.body).find(
      (b) => b?.type === 'TextualBody' && (!b.purpose || b.purpose === 'commenting'),
    )?.value;
    const extra = item.penciled ?? {};
    const annotation = normalize(
      {
        ...(item.id && { id: item.id.replace(/^urn:uuid:/, '') }),
        quote: quote.exact,
        prefix: quote.prefix ?? '',
        suffix: quote.suffix ?? '',
        start: position?.start ?? 0,
        end: position?.end ?? 0,
        ...extra,
        ...(note && { note }),
        ...(item.created && { createdAt: item.created }),
        ...(item.modified && { updatedAt: item.modified }),
      },
      options.color ?? 'yellow',
    );
    if (annotation) out.push(annotation);
  }
  return out;
}
