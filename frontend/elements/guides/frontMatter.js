// Metadata travels inside the document so it survives a download and upload. Flat scalar keys only,
// which keeps a YAML parser out of the bundle.

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

// Written in this order so a re-saved document diffs cleanly against its previous version.
const KEY_ORDER = ['route', 'title', 'order'];

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

// Inside double quotes, \" and \\ stand for the character, as quoteIfNeeded writes them.
const unquote = (value) => {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  if (!quoted) return value;
  return quoted[1] === '"' ? quoted[2].replace(/\\(["\\])/g, '$1') : quoted[2];
};

// Quoted only when a colon or surrounding whitespace wouldn't survive the round trip.
const quoteIfNeeded = (value) => {
  const raw = String(value);
  const needsQuotes = raw.includes(':') || raw !== raw.trim() || /^['"]/.test(raw);
  return needsQuotes ? `"${raw.replace(/["\\]/g, '\\$&')}"` : raw;
};

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

export const applyFrontMatter = (raw, patch) => {
  const { meta, body } = parseFrontMatter(raw);
  return serializeFrontMatter({ ...meta, ...patch }, body);
};
