# Show us where anchoring fails

penciled's hardest problem is finding an annotation's text again after the page changes. It stores each annotation's quote, the text around it and its position, then tries the position, then exact matches scored by context, then a fuzzy search. When it can't be sure, it doesn't guess: the annotation is orphaned instead of highlighting the wrong words. [Anchoring and limitations](https://www.penciled.org/guides/anchoring/) explains the details.

We'd like your failure cases, both kinds:

- **Wrong text highlighted.** This is the one we care about most: penciled should never do it.
- **Orphaned when it shouldn't be.** The text is clearly still there, but the annotation was set aside.

## What to post

- The content before and after the change: HTML, or a link to a page and its old version.
- Which text was annotated.
- What happened, and what you expected.
- The penciled version and browser.

A reduced example is ideal, but a messy real one is welcome too. Good cases become fixtures in [`test/anchoring.test.ts`](https://github.com/marcellosso/penciled/blob/main/packages/penciled/test/anchoring.test.ts), so the fix stays fixed.
