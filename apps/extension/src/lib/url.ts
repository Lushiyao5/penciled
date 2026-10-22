/** Query parameters that record where a visit came from without changing what the page shows. */
const TRACKING =
  /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|ref|ref_src|ref_url)$/i;

/**
 * The id a page's annotations are stored under: its URL without the fragment, tracking parameters,
 * a `www.` prefix or a trailing slash, so that links to the same page from different places share
 * them. If two URLs still differ, nothing is lost: annotations that can't be found are orphaned.
 */
export function pageId(href: string): string {
  const url = new URL(href);
  url.hash = '';
  url.hostname = url.hostname.replace(/^www\./, '');
  // Only rewritten when something is removed, since rewriting re-encodes the rest.
  // forEach rather than keys(): in Firefox content scripts, iterators of page objects aren't
  // iterable.
  const tracking: string[] = [];
  url.searchParams.forEach((_, key) => {
    if (TRACKING.test(key)) tracking.push(key);
  });
  for (const key of tracking) url.searchParams.delete(key);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href.replace(/\?$/, '');
}
