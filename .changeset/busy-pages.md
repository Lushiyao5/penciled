---
'penciled': minor
---

Re-anchoring now costs much less on large pages and pages that keep changing:

- Indexing a page's text was quadratic in the number of text nodes in Chromium. A long Wikipedia article went from about 165 ms to 13 ms.
- On content that changes faster than every 100 ms (tickers, live feeds), re-anchoring was postponed indefinitely. Changes now join the pending batch, so highlights keep up.
- With no annotations, penciled no longer watches the page or builds its text index until text is selected.
- When re-anchoring is slow, it is spaced out to take about a tenth of the main thread at most, and it runs when the browser is idle.
- Hidden tabs re-anchor when they're shown again.
