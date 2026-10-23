// The FAQ on the landing page and in its FAQPage structured data. The README has the same
// questions and answers, so change both together.
export interface Faq {
  question: string;
  answer: string;
}

export const faq: Faq[] = [
  {
    question: 'What is penciled?',
    answer:
      "penciled (penciled.js) is a 15 kB open-source JavaScript library that lets readers highlight text and write notes on any web page. Call annotate('#article') and readers get a floating toolbar and a note editor. Annotations are saved to localStorage, or to your own backend through a storage adapter. It's MIT licensed and published on npm as penciled.",
  },
  {
    question: "Does penciled modify my page's DOM?",
    answer:
      'No. Highlights are painted by the browser with the CSS Custom Highlight API, so your text is never wrapped in <mark> or <span> elements, and frameworks can re-render the page as often as they like. The only elements penciled adds are its own toolbar, note editor and screen-reader live region, outside your content.',
  },
  {
    question: 'Does it work with React and server-side rendering?',
    answer:
      'Yes. penciled/react has a useAnnotations() hook and an <Annotatable> component, and every entry point is safe to import during server-side rendering, in Next.js, Astro, Remix and others. Only annotate() needs a browser. With other frameworks, call annotate() on a mounted element and destroy() when it unmounts.',
  },
  {
    question: 'Can I save annotations to my own backend?',
    answer:
      'Yes. Pass a storage adapter with async load() and save() methods, and optionally create(), update() and delete() to save one annotation at a time. Annotations are plain JSON, and toW3C() converts them to W3C Web Annotations.',
  },
  {
    question: 'How is penciled different from web-highlighter or Recogito?',
    answer:
      "web-highlighter wraps each highlight in <span> elements and leaves the UI and storage to you. Recogito's Text Annotator is a larger framework built around the W3C Web Annotation model, with multi-user features, for research and collaborative annotation. penciled never changes your DOM, ships a toolbar, note editor and persistence, and is about 15 kB with the UI. In exchange it needs a browser with the CSS Custom Highlight API, while both of the others also work in older browsers. The comparison page at https://www.penciled.org/compare/ covers them and three more.",
  },
  {
    question: 'Is this penciled.com, the healthcare company?',
    answer:
      'No. penciled.js is an open-source JavaScript library, at penciled.org. It is not related to Penciled, the healthcare company at penciled.com.',
  },
];
