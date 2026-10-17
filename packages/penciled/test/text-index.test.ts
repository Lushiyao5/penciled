import { afterEach, describe, expect, test } from 'vitest';
import { buildIndex } from '../src/engine/anchoring/text.ts';
import { cleanup, mount } from './helpers.ts';

afterEach(cleanup);

describe('buildIndex', () => {
  test('collapses whitespace runs to a single space and drops leading whitespace', () => {
    const { root } = mount('\n  <p>Hello,\n    world!</p>\n  <p>  Second\tline </p>\n');
    expect(buildIndex(root).text).toBe('Hello, world! Second line ');
  });

  test('treats non-breaking spaces as whitespace', () => {
    const { root } = mount('<p>a&nbsp;&nbsp;b</p>');
    expect(buildIndex(root).text).toBe('a b');
  });

  test('skips script, style, template and noscript', () => {
    const { root } = mount(
      '<p>one</p><script>var x = 1</script><style>p{}</style><template>t</template><p>two</p>',
    );
    expect(buildIndex(root).text).toBe('onetwo');
  });

  test('skips library UI nodes marked with data-penciled', () => {
    const { root } = mount('<p>one <span data-penciled>ui</span>two</p>');
    expect(buildIndex(root).text).toBe('one two');
  });

  test('maps DOM points to offsets', () => {
    const { root, range } = mount('<p>  Hello <b>[[big]]</b>   world</p>');
    const index = buildIndex(root);
    expect(index.text).toBe('Hello big world');
    expect(index.offset(range!.startContainer, range!.startOffset)).toBe(6);
    expect(index.offset(range!.endContainer, range!.endOffset)).toBe(9);
    // Element boundary points.
    expect(index.offset(root, 0)).toBe(0);
    expect(index.offset(root, root.childNodes.length)).toBe(index.text.length);
    // Outside the root clamps.
    expect(index.offset(document.body, 0)).toBe(0);
  });

  test('maps offsets inside a collapsed run to the next character', () => {
    const { root } = mount('<p>a   b</p>');
    const index = buildIndex(root);
    const text = root.querySelector('p')!.firstChild!;
    expect(index.offset(text, 2)).toBe(2);
    expect(index.range(2, 3).toString()).toBe('b');
  });

  test('builds ranges from offsets, across nodes', () => {
    const { root } = mount('<p>Hello <b>big</b>\n\n  <i>wide</i> world</p>');
    const index = buildIndex(root);
    expect(index.text).toBe('Hello big wide world');
    for (const [s, e] of [
      [0, 5],
      [6, 9],
      [6, 14],
      [8, 11],
      [0, 20],
      [15, 20],
    ] as const) {
      const r = index.range(s, e);
      expect(r.toString().replace(/\s+/g, ' ')).toBe(index.text.slice(s, e));
      expect(index.offset(r.startContainer, r.startOffset)).toBe(s);
      expect(index.offset(r.endContainer, r.endOffset)).toBe(e);
    }
  });

  test('ranges do not swallow the collapsed whitespace around them', () => {
    const { root } = mount('<p>one</p>\n   <p>two</p>');
    const index = buildIndex(root);
    expect(index.text).toBe('one two');
    expect(index.range(0, 3).toString()).toBe('one');
    expect(index.range(4, 7).toString()).toBe('two');
  });
});
