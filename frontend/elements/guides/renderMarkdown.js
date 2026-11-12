import { figureName } from './figureRefs';
import { loadModule } from '../../functions/modules';

// marked and DOMPurify, once loadMarkdown has them.
let libraries = null;

// renderMarkdown stays synchronous (the TOC reads headings in the same commit, the help window is
// written inside the click), so a surface awaits this before it renders.
export const loadMarkdown = () => loadModule('markdown').then((module) => {
  libraries = module;
  return module;
});

export const markdownReady = () => libraries !== null;

const loaded = () => {
  if (!libraries) throw new Error('renderMarkdown ran before loadMarkdown resolved');
  return libraries;
};

// marked passes raw HTML straight through, so everything is sanitized before it reaches the DOM.
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'blockquote',
  'strong', 'em', 'del', 'code', 'pre',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

// Each block's source line, for scroll sync with the editor. Allowed by name; ALLOW_DATA_ATTR stays off.
export const LINE_ATTR = 'data-md-line';

const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'align', 'colspan', 'rowspan', LINE_ATTR];

// Nodes rather than a string, so innerHTML doesn't parse the document a second time.
const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  RETURN_DOM_FRAGMENT: true,
};

const MARKED_OPTIONS = { gfm: true, breaks: false, async: false };

const FIRST_TAG = /^(\s*)<([a-z][a-z0-9-]*)/i;

const tagWithLine = (html, line) =>
  html.replace(FIRST_TAG, (_match, space, tag) => `${space}<${tag} ${LINE_ATTR}="${line}"`);

// One token at a time, stamped before sanitizing: a block DOMPurify drops loses its own anchor
// instead of shifting every later one.
const renderToHtml = (source) => {
  const { marked } = loaded();
  const tokens = marked.lexer(source, MARKED_OPTIONS);
  let line = 1;
  let html = '';

  for (const token of tokens) {
    const start = line;
    line += (token.raw.match(/\n/g) ?? []).length;
    if (token.type === 'space') continue;

    const chunk = [token];
    chunk.links = tokens.links;
    html += tagWithLine(marked.parser(chunk, MARKED_OPTIONS), start);
  }
  return html;
};

// DOMPurify's URI allow-list has no blob:, so images go through as filenames and get their object
// URLs afterwards. Throws until loadMarkdown has resolved.
export const renderMarkdown = (markdown, resolveImage) => {
  const fragment = loaded().DOMPurify.sanitize(renderToHtml(markdown ?? ''), PURIFY_CONFIG);

  fragment.querySelectorAll('img').forEach((img) => {
    // marked percent-encodes the src; figureName undoes it.
    const name = figureName(img.getAttribute('src') ?? '');
    img.removeAttribute('src');
    const resolved = name && resolveImage ? resolveImage(name) : null;
    if (resolved) {
      img.setAttribute('src', resolved);
    } else {
      // A visible placeholder, so an author can see which reference failed.
      img.setAttribute('data-help-missing-image', name ?? '');
    }
  });

  // Help opens inside an authenticated app; a document link must never navigate the app frame.
  fragment.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  });

  return fragment;
};
