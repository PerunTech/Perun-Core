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

// The editor and the view share this list, so a view keeps exactly what the editor would. The
// editor passes its own `image`, which draws the same node through resolveImage.
export const richTextExtensions = (libs, { placeholder = '', image = inlineImage(libs) } = {}) => [
  libs.StarterKit.configure({
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  image,
  libs.TableKit.configure({ table: { resizable: false } }),
  libs.Placeholder.configure({ placeholder }),
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
