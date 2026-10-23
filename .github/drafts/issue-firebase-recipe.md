# Recipe: save annotations to Firebase (Firestore)

Like the Supabase recipe, but for Firestore: a docs page showing a [storage adapter](https://www.penciled.org/recipes/rest-storage/) that saves each user's annotations.

## What the recipe should cover

- A document layout, for example `users/{uid}/documents/{documentId}/annotations/{annotationId}`, and the security rules that keep each user to their own data.
- An adapter with `load(documentId)`, `create`, `update` and `delete`, using the modular Firebase SDK (`firebase/firestore`).
- Recreating the instance when the signed-in user changes.
- Whether to use Firestore's offline persistence, and what penciled's `error` event sees when a write fails.

## Where to start

- Model it on [`apps/docs/src/content/docs/recipes/rest-storage.mdx`](../../apps/docs/src/content/docs/recipes/rest-storage.mdx).
- Add the page as `recipes/firebase-storage.mdx` and list it in the sidebar in `apps/docs/astro.config.mjs`.
- Test it against a real Firebase project before opening the PR.
