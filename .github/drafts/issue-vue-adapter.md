# Add a Vue adapter (`penciled/vue`)

penciled works in Vue today by calling `annotate()` in `onMounted` and `destroy()` in `onUnmounted`, but a small adapter would make it feel native, like [`penciled/react`](../../packages/penciled/src/react/index.ts) does for React.

## What it could look like

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAnnotations } from 'penciled/vue';
import 'penciled/styles.css';

const article = ref<HTMLElement | null>(null);
const penciled = useAnnotations(article, { documentId: 'post-42' });
</script>

<template>
  <article ref="article"><slot /></article>
</template>
```

Plus, optionally, an `<Annotatable>` component that renders an element and annotates it.

## Behaviour to match the React adapter

- The instance is created after mount and destroyed on unmount. Importing must stay SSR-safe (Nuxt), so nothing touches `window` or `document` at module level.
- It's recreated when `documentId` or `readOnly` changes, `theme` applies live through `setTheme()`, and the `on…` callbacks always call their latest version. Other options are read once.
- The returned instance is `null` (or a `shallowRef` holding `null`) until mounted.

## Where to start

- [`packages/penciled/src/react/index.ts`](../../packages/penciled/src/react/index.ts) is about 80 lines, and the Vue version should be similar.
- Add `./vue` to `exports` in `packages/penciled/package.json`, an entry in `tsdown.config.ts`, and `vue` as an optional peer dependency, like `react`.
- Add browser tests next to the React ones in `packages/penciled/test/`, and a recipe in `apps/docs/src/content/docs/recipes/`.

Open question for the maintainer before starting: ship it as `penciled/vue` in this package, or as a separate package? Comment here first.
