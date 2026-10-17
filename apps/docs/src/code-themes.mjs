// Monochrome code themes in the site's graphite palette: only comments, strings and keywords
// differ, and only slightly.

function theme(name, type, c) {
  return {
    name,
    type,
    colors: { 'editor.background': c.bg, 'editor.foreground': c.fg },
    tokenColors: [
      { settings: { foreground: c.fg } },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: c.comment, fontStyle: 'italic' },
      },
      {
        scope: ['string', 'string.template', 'punctuation.definition.string'],
        settings: { foreground: c.string },
      },
      {
        scope: [
          'keyword',
          'storage',
          'storage.type',
          'keyword.control',
          'keyword.operator.new',
          'constant.language',
        ],
        settings: { foreground: c.keyword },
      },
      {
        scope: ['punctuation', 'meta.brace', 'keyword.operator'],
        settings: { foreground: c.punctuation },
      },
      {
        scope: ['entity.name.tag', 'support.class.component'],
        settings: { foreground: c.keyword },
      },
      {
        scope: ['entity.other.attribute-name', 'support.type.property-name'],
        settings: { foreground: c.fg },
      },
      { scope: ['constant.numeric'], settings: { foreground: c.string } },
    ],
  };
}

export const graphiteLight = theme('graphite-light', 'light', {
  bg: '#f3f1ed',
  fg: '#3d3b37',
  keyword: '#121110',
  string: '#7a5a3a',
  comment: '#a19d96',
  punctuation: '#8a867e',
});

export const graphiteDark = theme('graphite-dark', 'dark', {
  bg: '#1b1a18',
  fg: '#cfcbc4',
  keyword: '#f7f4ef',
  string: '#c8a985',
  comment: '#6f6b64',
  punctuation: '#8f8b84',
});
