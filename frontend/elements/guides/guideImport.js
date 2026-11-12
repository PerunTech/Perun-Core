import { figureNames } from './figureRefs'
import { mimeFromName } from './helpNames'
import { unzipEntries } from './zip'

// Checks only the file's shape: the caller shows the author what was read before anything is stored.

const MARKDOWN_NAME = /\.md$/i

const baseName = (name) => name.slice(name.lastIndexOf('/') + 1)

// The second pass is for an archive made by zipping a folder.
const entryFor = (entries, name) =>
  entries.find(entry => entry.name === name)
  ?? entries.find(entry => baseName(entry.name) === name)

export const readGuideUpload = async (file) => {
  if (MARKDOWN_NAME.test(file.name)) {
    const markdown = await file.text()
    return { name: file.name, markdown, figures: [], missing: figureNames(markdown) }
  }

  const entries = await unzipEntries(file)
  const document = entries.find(entry => MARKDOWN_NAME.test(entry.name))
  if (!document) throw new Error('no Markdown document in the archive')

  const markdown = new TextDecoder().decode(document.data)
  const rest = entries.filter(entry => entry !== document)
  const figures = []
  const missing = []

  // Driven by the references, so an entry the Markdown doesn't name isn't stored where nothing would
  // ever resolve it.
  figureNames(markdown).forEach(name => {
    const entry = entryFor(rest, name)
    if (entry) figures.push({ name, file: new File([entry.data], name, { type: mimeFromName(name) }) })
    else missing.push(name)
  })

  return { name: baseName(document.name), markdown, figures, missing }
}
