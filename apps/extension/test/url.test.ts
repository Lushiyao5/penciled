import { describe, expect, test } from 'vitest';
import { pageId } from '../src/lib/url.ts';

describe('pageId', () => {
  test.each([
    ['https://example.com/post#comments', 'https://example.com/post'],
    ['https://www.example.com/post', 'https://example.com/post'],
    ['https://example.com/post/', 'https://example.com/post'],
    ['https://example.com/', 'https://example.com/'],
    ['https://example.com/post?utm_source=x&utm_medium=y', 'https://example.com/post'],
    ['https://example.com/post?fbclid=1&gclid=2&ref=hn', 'https://example.com/post'],
    // Parameters that choose content are kept.
    ['https://example.com/item?id=123&utm_campaign=z', 'https://example.com/item?id=123'],
    ['https://news.ycombinator.com/item?id=1', 'https://news.ycombinator.com/item?id=1'],
    // Left alone when there's nothing to remove, encoding included.
    ['https://example.com/search?q=a%20b', 'https://example.com/search?q=a%20b'],
    ['http://localhost:5180/a.html', 'http://localhost:5180/a.html'],
  ])('%s → %s', (href, id) => {
    expect(pageId(href)).toBe(id);
  });
});
