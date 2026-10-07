// Help documents carry their routing metadata in a leading `---` fenced block, the way static site
// generators do. Keeping it inside the document means the metadata travels with the file through a
// download/upload round trip between environments, which nothing stored in a sibling DB column does.
//
// Only flat scalar keys are supported. That covers route/title/order and keeps a YAML parser out of
// a bundle that is committed and consumed by every dependent module.

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

// Written in this order so a re-saved document diffs cleanly against its previous version.
const KEY_ORDER = ['route', 'title', 'order'];

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const unquote = (value) => {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
};

// Quote only when a bare value would not survive the round trip: a colon would re-split on read,
// and surrounding whitespace would be trimmed away.
const quoteIfNeeded = (value) => {
  const raw = String(value);
  const needsQuotes = raw.includes(':') || raw !== raw.trim() || /^['"]/.test(raw);
  return needsQuotes ? `"${raw.replace(/"/g, '\\"')}"` : raw;
};

/**
 * Splits a raw document into its front matter keys and the Markdown body.
 * A document with no fenced block is not an error; it yields empty metadata and an untouched body.
 */
export const parseFrontMatter = (raw) => {
  const source = raw ?? '';
  const match = FENCE.exec(source);
  if (!match) return { meta: {}, body: source };

  const meta = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const sep = trimmed.indexOf(':');
    if (sep < 1) return;
    meta[trimmed.slice(0, sep).trim()] = unquote(trimmed.slice(sep + 1).trim());
  });

  return { meta, body: source.slice(match[0].length) };
};

/** Rebuilds a full document from metadata and body, dropping keys that carry no value. */
export const serializeFrontMatter = (meta, body) => {
  const source = meta ?? {};
  const ordered = KEY_ORDER.filter((key) => hasValue(source[key]));
  const extra = Object.keys(source).filter((key) => !KEY_ORDER.includes(key) && hasValue(source[key]));
  const keys = [...ordered, ...extra];
  const text = body ?? '';

  if (!keys.length) return text.replace(/^\s*\n/, '');

  const lines = keys.map((key) => `${key}: ${quoteIfNeeded(source[key])}`);
  return `---\n${lines.join('\n')}\n---\n\n${text.replace(/^\s*\n/, '')}`;
};

/**
 * Merges a patch into a document's front matter without touching its body. Backs the metadata form
 * above the editor, which writes through to the same buffer the author is typing in.
 */
export const applyFrontMatter = (raw, patch) => {
  const { meta, body } = parseFrontMatter(raw);
  return serializeFrontMatter({ ...meta, ...patch }, body);
};
