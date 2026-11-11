import { useEffect, useState } from 'react';
import { loadModule } from '../../functions/modules';

let libraries = null;

export const loadRichText = () => loadModule('rich-text').then((module) => {
  libraries = module;
  return module;
});

/** The TipTap libraries, null until they have loaded; `failed` once a load did not. */
export const useRichText = () => {
  const [libs, setLibs] = useState(libraries);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (libs) return undefined;
    let cancelled = false;
    loadRichText().then(
      (module) => { if (!cancelled) setLibs(module); },
      (err) => {
        console.error(err);
        if (!cancelled) setFailed(true);
      }
    );
    return () => { cancelled = true; };
  }, [libs]);

  return { libs, failed };
};

// Inline, as Word has them, so an image sits in its paragraph rather than splitting it.
export const inlineImage = (libs) => libs.Image.configure({ inline: true });

// Angle brackets keep a name with a space or a parenthesis one destination.
const markdownDestination = (src) => (/[\s()<>]/.test(src) ? `<${src}>` : src);

// Text that would start a block when it begins a line: headings, list items, rules, setext
// underlines and fences. The serializer escapes inline syntax but not these.
const BLOCK_STARTS = [
  [/^(\s{0,3})(#{1,6})(?=\s|$)/, '$1\\$2'],
  [/^(\s{0,3})([-_*])((?:[ \t]*\2){2,}[ \t]*)$/, '$1\\$2$3'],
  [/^(\s{0,3})([-+*])(?=\s|$)/, '$1\\$2'],
  [/^(\s{0,3})(\d{1,9})([.)])(?=\s|$)/, '$1$2\\$3'],
  [/^(\s{0,3})(=+[ \t]*)$/, '$1\\$2'],
  [/^(\s{0,3})(~{3,})/, '$1\\$2'],
];

export const escapeBlockStarts = (markdown) => markdown
  .replace(/^ {4,}/, '')
  .split('\n')
  .map(line => BLOCK_STARTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), line))
  .join('\n');

const markdownParagraph = (libs) => libs.Paragraph.extend({
  // Paragraph unwraps a lone image as a block, but these images are inline.
  parseMarkdown(token, helpers) {
    const tokens = token.tokens ?? [];
    if (tokens.length === 1 && tokens[0].type === 'image') return helpers.createNode('paragraph', undefined, helpers.parseInline(tokens));
    return this.parent?.(token, helpers);
  },
  renderMarkdown(node, helpers, context) {
    return escapeBlockStarts(this.parent?.(node, helpers, context) ?? '');
  },
});

// Markdown lets inline code sit in bold or a link, which TipTap's code mark otherwise refuses.
const markdownCode = (libs) => libs.Code.extend({ excludes: 'code' });

// OrderedList's own tokenizer misreads an item's indent, shifting its code blocks a space. marked's
// list rules read it right and are the ones the Help panel renders with, and BulletList already
// parses their items this way.
const markdownOrderedList = (libs) => libs.OrderedList.extend({
  markdownTokenizer: null,
  parseMarkdown: (token, helpers) => {
    if (token.type !== 'list' || !token.ordered) return [];
    const content = token.items ? helpers.parseChildren(token.items) : [];
    return token.start > 1 || token.start === 0
      ? { type: 'orderedList', attrs: { start: token.start }, content }
      : { type: 'orderedList', content };
  },
});

// In a tight item marked calls each run of text `text`, not `paragraph`, and ListItem puts one
// that follows a code block or a nested list in the item as bare, unparsed text.
const markdownListItem = (libs) => libs.ListItem.extend({
  parseMarkdown(token, helpers) {
    const tokens = token.tokens?.map(child => (child.type === 'text' && child.tokens ? { ...child, type: 'paragraph' } : child));
    return this.parent?.({ ...token, tokens }, helpers);
  },
});

// GFM needs a header row, so a table without one, as Word pastes it, gives its first row the part
// rather than gaining an empty row above it.
const markdownTable = (libs) => libs.Table.extend({
  renderMarkdown(node, helpers) {
    const [first, ...rest] = node.content ?? [];
    const headed = first && !first.content?.some(cell => cell.type === 'tableHeader')
      ? { ...node, content: [{ ...first, content: first.content?.map(cell => ({ ...cell, type: 'tableHeader' })) }, ...rest] }
      : node;
    return (this.parent?.(headed, helpers) ?? '').replace(/^\n+|\n+$/g, '');
  },
}).configure({ resizable: false });

const markdownImage = (image) => image.extend({
  renderMarkdown: ({ attrs = {} }) => {
    const alt = (attrs.alt ?? '').replace(/([[\]\\])/g, '\\$1');
    const title = attrs.title ? ` "${attrs.title.replace(/"/g, '\\"')}"` : '';
    return `![${alt}](${markdownDestination(attrs.src ?? '')}${title})`;
  },
});

// The editor and the view share this list; the editor passes an `image` drawn through resolveImage.
// `markdown` drops underline, which Markdown cannot write, and gives each editor a marked of its own,
// since the extension registers its tokenizers on it.
export const richTextExtensions = (libs, { placeholder = '', image = inlineImage(libs), markdown = false } = {}) => [
  libs.StarterKit.configure({
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    ...(markdown ? { underline: false, paragraph: false, code: false, orderedList: false, listItem: false } : {}),
  }),
  ...(markdown ? [markdownParagraph(libs), markdownCode(libs), markdownOrderedList(libs), markdownListItem(libs)] : []),
  markdown ? markdownImage(image) : image,
  libs.TableKit.configure({ table: markdown ? false : { resizable: false } }),
  ...(markdown ? [markdownTable(libs)] : []),
  libs.Placeholder.configure({ placeholder }),
  ...(markdown ? [libs.Markdown.configure({ marked: new libs.Marked() })] : []),
];

// A bare file name, as a document refers to an image stored beside it: no scheme, no path.
const FILE_REFERENCE = /^[^:/?#]+$/;

/**
 * What an img shows for a stored src: what resolveImage makes of it, else the src itself, except
 * that a file name resolveImage does not know shows nothing rather than asking the page's own
 * folder for it.
 */
export const imageSource = (src, resolveImage) => {
  if (!src) return null;
  const resolved = resolveImage?.(src);
  if (resolved) return resolved;
  return resolveImage && FILE_REFERENCE.test(src) ? null : src;
};

export const drawImage = (img, { src, alt, title }, resolveImage) => {
  const shown = imageSource(src, resolveImage);
  if (shown) {
    img.setAttribute('src', shown);
    img.removeAttribute('data-rte-missing');
  } else {
    img.removeAttribute('src');
    img.setAttribute('data-rte-missing', src ?? '');
  }
  if (alt) img.setAttribute('alt', alt); else img.removeAttribute('alt');
  if (title) img.setAttribute('title', title); else img.removeAttribute('title');
};

/** The Image node, drawn through resolveImage: the document keeps the stored src, the page shows the resolved one. */
export const resolvedImage = (libs, resolveRef, redraws) => inlineImage(libs).extend({
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('img');
      let current = node;
      const draw = () => drawImage(dom, current.attrs, resolveRef.current);
      redraws.add(draw);
      draw();
      return {
        dom,
        update(next) {
          if (next.type !== current.type) return false;
          current = next;
          draw();
          return true;
        },
        destroy() { redraws.delete(draw); },
      };
    };
  },
});

/** The file names a document's images refer to. */
export const imageReferences = (html) => {
  if (!html) return new Set();
  const body = new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  return new Set([...body.querySelectorAll('img[src]')]
    .map(img => img.getAttribute('src'))
    .filter(src => FILE_REFERENCE.test(src)));
};

const schemas = new WeakMap();

const viewSchema = (libs) => {
  if (!schemas.has(libs)) schemas.set(libs, libs.getSchema(richTextExtensions(libs)));
  return schemas.get(libs);
};

/**
 * Stored HTML as the editor's schema reads it, so anything it has no node, mark or attribute
 * for (scripts, handlers, styles, unsafe link targets) is dropped rather than shown. Images go
 * through `resolveImage` as they do in the editor.
 *
 * @returns {DocumentFragment}
 */
export const renderRichText = (html, libs, resolveImage) => {
  if (!html?.trim()) return document.createDocumentFragment();
  const schema = viewSchema(libs);
  // A DOMParser document is inert: nothing in it runs or loads while it is read.
  const body = new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const doc = libs.SchemaParser.fromSchema(schema).parse(body);
  // Serialized into an inert document too, so no image is asked for before it has been resolved.
  const fragment = libs.SchemaSerializer.fromSchema(schema)
    .serializeFragment(doc.content, { document: body.ownerDocument });
  fragment.querySelectorAll('img').forEach(img => drawImage(img, {
    src: img.getAttribute('src'), alt: img.getAttribute('alt'), title: img.getAttribute('title'),
  }, resolveImage));
  return document.importNode(fragment, true);
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** What the link field was given, as an href: a bare domain gets https://, a bare address mailto:. */
export const normalizeHref = (input) => {
  const href = (input ?? '').trim();
  if (!href || SCHEME.test(href) || /^[/#?.]/.test(href)) return href;
  return /^[^\s@/]+@[^\s@/]+$/.test(href) ? `mailto:${href}` : `https://${href}`;
};
