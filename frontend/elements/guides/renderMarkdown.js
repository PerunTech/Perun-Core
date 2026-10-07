import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { figureName } from './figureRefs';

// Markdown output is not safe just because the source is Markdown: marked passes raw HTML in the
// document straight through. Everything below runs through DOMPurify before it reaches the DOM.
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'blockquote',
  'strong', 'em', 'del', 'code', 'pre',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

// Carries the source line each block came from, so the preview can be scrolled to the same place
// in the document as the editor. ALLOW_DATA_ATTR stays off; this one attribute is allowed by name.
export const LINE_ATTR = 'data-md-line';

const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'align', 'colspan', 'rowspan', LINE_ATTR];

// RETURN_DOM_FRAGMENT hands back nodes instead of a string, so the result can be appended straight
// into the page. Serializing to HTML and letting innerHTML re-parse it would parse the same
// document twice on every render.
const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  RETURN_DOM_FRAGMENT: true,
};

const MARKED_OPTIONS = { gfm: true, breaks: false, async: false };

const FIRST_TAG = /^(\s*)<([a-z][a-z0-9-]*)/i;

/** Stamps the source line onto the first element of a rendered block. */
const tagWithLine = (html, line) =>
  html.replace(FIRST_TAG, (_match, space, tag) => `${space}<${tag} ${LINE_ATTR}="${line}"`);

/**
 * Renders to HTML one top-level token at a time, so each block can be stamped with the line it
 * started on. Line numbers come from the running total of newlines in each token's `raw`.
 *
 * Stamping before sanitizing rather than after is what keeps the mapping honest: DOMPurify drops
 * whole elements, and a block removed here simply loses its anchor instead of shifting every
 * anchor after it, which is what a positional match against the token list would have done.
 */
const renderToHtml = (source) => {
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

/**
 * Renders a Markdown body to a sanitized DocumentFragment, resolving image filenames through
 * `resolveImage`.
 *
 * The order here is load-bearing. DOMPurify's default URI allow-list covers http(s), mailto, tel,
 * callto, sms, cid, xmpp and matrix, and has no `blob:` scheme, so sanitizing a document that
 * already carries blob URLs strips every figure with no error anywhere. Images are therefore left
 * as their plain filenames through the sanitizer and swapped on the fragment afterwards, which
 * also means this code decides exactly which sources get set rather than widening the sanitizer.
 *
 * @param {string} markdown     document body, front matter already removed
 * @param {(name: string) => string|null} resolveImage  filename to object URL, null if unresolved
 * @returns {DocumentFragment} nodes ready to append
 */
export const renderMarkdown = (markdown, resolveImage) => {
  const fragment = DOMPurify.sanitize(renderToHtml(markdown ?? ''), PURIFY_CONFIG);

  fragment.querySelectorAll('img').forEach((img) => {
    // marked percent-encodes the destination it renders, so the src is not the name the author
    // wrote and is not how any figure map is keyed. figureName undoes that, which is what lets a
    // figure named with a space or in a non-Latin script resolve.
    const name = figureName(img.getAttribute('src') ?? '');
    img.removeAttribute('src');
    const resolved = name && resolveImage ? resolveImage(name) : null;
    if (resolved) {
      img.setAttribute('src', resolved);
    } else {
      // Leave a visible, styleable placeholder rather than a broken image icon, so an author who
      // mistypes a filename can see which reference failed.
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
