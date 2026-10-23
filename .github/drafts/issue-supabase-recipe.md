# Recipe: save annotations to Supabase

Many people trying penciled will want to save annotations per user. A docs recipe showing a [storage adapter](https://www.penciled.org/recipes/rest-storage/) backed by Supabase would cover a common setup, with no change to the library.

## What the recipe should cover

- A table, for example `annotations (id text primary key, user_id uuid, document_id text, data jsonb, updated_at timestamptz)`, and the row-level security policies so each user only reads and writes their own rows.
- An adapter that implements `load(documentId)`, plus `create`, `update` and `delete`, so each change is one request instead of rewriting the whole document. See [One request per change](https://www.penciled.org/recipes/rest-storage/#one-request-per-change).
- Recreating the instance when the signed-in user changes, as in [Switching users or documents](https://www.penciled.org/recipes/rest-storage/#switching-users-or-documents).
- What happens offline or when a request fails (the `error` event).

## Where to start

- Model it on [`apps/docs/src/content/docs/recipes/rest-storage.mdx`](../../apps/docs/src/content/docs/recipes/rest-storage.mdx).
- Add the page as `recipes/supabase-storage.mdx` and list it in the sidebar in `apps/docs/astro.config.mjs`.
- Test it against a real Supabase project before opening the PR, and say so in the PR.
