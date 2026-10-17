import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { graphiteDark, graphiteLight } from './src/code-themes.mjs';

// The public URL, for canonical links, Open Graph and the sitemap. Set SITE_URL, or let Vercel
// provide its production domain. Without either (local builds), those are left out.
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
const ogImage = site ? new URL('/og.png', site).href : '/og.png';

export default defineConfig({
  site,
  integrations: [
    starlight({
      title: 'penciled',
      description:
        'A tiny, framework-agnostic JavaScript library for persistent text highlights and notes on any webpage.',
      favicon: '/favicon.svg',
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: ogImage } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        {
          tag: 'meta',
          attrs: { property: 'og:image:alt', content: 'penciled: Read with a pencil in hand.' },
        },
        { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            content: '#fbfaf8',
            media: '(prefers-color-scheme: light)',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#141413', media: '(prefers-color-scheme: dark)' },
        },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/marcellosso/penciled' },
      ],
      editLink: {
        baseUrl: 'https://github.com/marcellosso/penciled/edit/main/apps/docs/',
      },
      customCss: [
        '@fontsource-variable/source-serif-4/opsz.css',
        '@fontsource-variable/geist',
        '@fontsource-variable/geist-mono',
        './src/styles/tokens.css',
        'penciled/styles.css',
        './src/styles/starlight.css',
        './src/styles/custom.css',
      ],
      expressiveCode: {
        themes: [graphiteDark, graphiteLight],
        defaultProps: { wrap: true, overridesByLang: { 'sh,bash,shell': { frame: 'none' } } },
        styleOverrides: {
          borderRadius: '0.625rem',
          borderWidth: '0px',
          codeFontFamily: 'var(--pd-mono)',
          codeFontSize: '0.8125rem',
          codeLineHeight: '1.7',
          codePaddingBlock: '1rem',
          codePaddingInline: '1.125rem',
          uiFontFamily: 'var(--pd-sans)',
          frames: {
            shadowColor: 'transparent',
            frameBoxShadowCssValue: 'none',
            editorTabBarBackground: 'transparent',
            editorTabBarBorderBottomColor: 'transparent',
            editorTabBarBorderColor: 'transparent',
            editorActiveTabBackground: 'transparent',
            editorActiveTabForeground: 'var(--pd-muted)',
            editorActiveTabBorderColor: 'transparent',
            editorActiveTabIndicatorTopColor: 'transparent',
            editorActiveTabIndicatorBottomColor: 'transparent',
            editorTabsMarginInlineStart: '0',
            terminalBackground: 'var(--pd-paper)',
            terminalTitlebarBackground: 'transparent',
            terminalTitlebarBorderBottomColor: 'transparent',
            terminalTitlebarDotsOpacity: '0',
            terminalTitlebarForeground: 'var(--pd-muted)',
            inlineButtonBackground: 'var(--pd-fg)',
            inlineButtonForeground: 'var(--pd-fg)',
            inlineButtonBorder: 'var(--pd-hairline-strong)',
            inlineButtonBorderOpacity: '0',
            inlineButtonBackgroundIdleOpacity: '0',
            inlineButtonBackgroundHoverOrFocusOpacity: '0.08',
            inlineButtonBackgroundActiveOpacity: '0.12',
          },
        },
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Getting started', slug: 'getting-started' },
            { label: 'Playground', slug: 'playground' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Theming and customization', slug: 'guides/theming' },
            { label: 'Anchoring and limitations', slug: 'guides/anchoring' },
            { label: 'Browser support', slug: 'guides/browser-support' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'React', slug: 'recipes/react' },
            { label: 'Custom storage (REST API)', slug: 'recipes/rest-storage' },
            { label: '“Ask AI” action', slug: 'recipes/ask-ai' },
            { label: 'Read-only publisher annotations', slug: 'recipes/read-only' },
            { label: 'Export, import and W3C', slug: 'recipes/export-import' },
          ],
        },
        {
          label: 'API reference',
          items: [
            { label: 'annotate() options', slug: 'reference/options' },
            { label: 'Instance', slug: 'reference/instance' },
            { label: 'Events', slug: 'reference/events' },
            { label: 'Types', slug: 'reference/types' },
            { label: 'penciled/headless', slug: 'reference/headless' },
          ],
        },
      ],
    }),
  ],
});
