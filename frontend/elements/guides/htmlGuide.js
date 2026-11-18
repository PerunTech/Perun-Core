// A rich text guide is a whole page, so a downloaded or zipped copy keeps its metadata and opens in a
// browser: the title in <title>, route and order in <meta> tags, the editor's HTML as the body.

const META_KEYS = ['route', 'order']

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== ''

const escapeText = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const escapeAttribute = (value) => escapeText(value).replace(/"/g, '&quot;')

// A fragment without a page around it is all body, as an editor's HTML pasted into a file would be.
const PAGE_MARKUP = /<(?:!doctype|html|head|body|title|meta)\b/i

export const parseHtmlGuide = (raw) => {
  const source = raw ?? ''
  if (!PAGE_MARKUP.test(source)) return { meta: {}, body: source.trim() }

  // Inert: nothing in a parsed document runs or loads.
  const page = new window.DOMParser().parseFromString(source, 'text/html')
  const meta = {}
  const title = page.querySelector('title')
  if (title) meta.title = title.textContent.trim()
  META_KEYS.forEach((key) => {
    const content = page.querySelector(`meta[name="${key}"]`)?.getAttribute('content')
    if (hasValue(content)) meta[key] = content.trim()
  })

  return { meta, body: page.body.innerHTML.trim() }
}

export const serializeHtmlGuide = (meta, body) => {
  const source = meta ?? {}
  const head = [
    '<meta charset="utf-8">',
    `<title>${escapeText(hasValue(source.title) ? source.title : '')}</title>`,
    ...META_KEYS.filter(key => hasValue(source[key]))
      .map(key => `<meta name="${key}" content="${escapeAttribute(source[key])}">`),
  ]
  const content = (body ?? '').trim()
  return `<!doctype html>\n<html>\n<head>\n${head.join('\n')}\n</head>\n<body>\n${content ? `${content}\n` : ''}</body>\n</html>\n`
}

export const applyHtmlGuide = (raw, patch) => {
  const { meta, body } = parseHtmlGuide(raw)
  return serializeHtmlGuide({ ...meta, ...patch }, body)
}
