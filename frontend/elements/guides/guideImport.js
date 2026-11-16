import { guideFormat } from './guideFormat'
import { DOC_KIND, HTML_KIND, mimeFromName } from './helpNames'
import { unzipEntries } from './zip'

// Checks only the file's shape: the caller shows the author what was read before anything is stored.

const MARKDOWN_NAME = /\.md$/i
// A rich text guide only comes in an archive, as it is exported: alone it would have no figures.
const DOCUMENT_NAME = /\.(md|html)$/i

const baseName = (name) => name.slice(name.lastIndexOf('/') + 1)

const kindOf = (name) => (/\.html$/i.test(name) ? HTML_KIND : DOC_KIND)

// The second pass is for an archive made by zipping a folder.
const entryFor = (entries, name) =>
  entries.find(entry => entry.name === name)
  ?? entries.find(entry => baseName(entry.name) === name)

export const readGuideUpload = async (file) => {
  if (MARKDOWN_NAME.test(file.name)) {
    const text = await file.text()
    return { name: file.name, kind: DOC_KIND, text, figures: [], missing: guideFormat(DOC_KIND).figureNames(text) }
  }

  const entries = await unzipEntries(file)
  const document = entries.find(entry => DOCUMENT_NAME.test(entry.name))
  if (!document) throw new Error('no guide document in the archive')

  const kind = kindOf(document.name)
  const format = guideFormat(kind)
  const text = new TextDecoder().decode(document.data)
  const rest = entries.filter(entry => entry !== document)
  const figures = []
  const missing = []

  // Driven by the references, so an entry the document doesn't name isn't stored where nothing would
  // ever resolve it.
  format.figureNames(format.parse(text).body).forEach(name => {
    const entry = entryFor(rest, name)
    if (entry) figures.push({ name, file: new File([entry.data], name, { type: mimeFromName(name) }) })
    else missing.push(name)
  })

  return { name: baseName(document.name), kind, text, figures, missing }
}
