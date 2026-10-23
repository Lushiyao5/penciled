# Add a Svelte adapter (`penciled/svelte`)

penciled works in Svelte today, but an [action](https://svelte.dev/docs/svelte/use) would make it a one-liner:

```svelte
<script>
  import { annotations } from 'penciled/svelte';
  import 'penciled/styles.css';
</script>

<article use:annotations={{ documentId: 'post-42' }}>
  ...
</article>
```

## Behaviour

- The action calls `annotate(node, options)` and returns `{ update, destroy }`. `destroy` calls the instance's `destroy()`.
- `update(options)` recreates the instance when `documentId` or `readOnly` changes and calls `setTheme()` when `theme` changes, the same rules as [`penciled/react`](../../packages/penciled/src/react/index.ts).
- Code that needs the instance (to call `getAll()` or `export()`, say) needs a way to get it: an `oninstance` callback in the options, or an `onready` event on the node. Propose one in the PR.
- Importing must stay SSR-safe (SvelteKit).

## Where to start

- Read the React adapter, [`packages/penciled/src/react/index.ts`](../../packages/penciled/src/react/index.ts).
- An action needs no Svelte import at all, so it may not even need `svelte` as a peer dependency.
- Add `./svelte` to `exports` and `tsdown.config.ts`, browser tests in `packages/penciled/test/` and a recipe in `apps/docs/src/content/docs/recipes/`.

Comment here before starting, to agree on the API.
