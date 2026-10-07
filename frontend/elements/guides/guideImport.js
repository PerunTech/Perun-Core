import { figureNames } from './figureRefs'
import { mimeFromName } from './helpNames'
import { unzipEntries } from './zip'

/**
 * Reads a guide back out of a file, the way downloadGuideArchive wrote it.
 *
 * The two forms are the two an author has: the Markdown alone, and the Markdown with its figures
 * beside it. A PDF is not one of them, being a manual rather than a source, and is stored as it
 * stands by a different path.
 *
 * Nothing is written here and nothing is validated beyond the shape of the file. What the document
 * claims about itself is the caller's business, because the caller is the surface that shows the
 * author what was read and lets them correct it before any of it is stored.
 */

const MARKDOWN_NAME = /\.md$/i

/** The name a flat archive would have used, so a foldered one still matches the references. */
const baseName = (name) => name.slice(name.lastIndexOf('/') + 1)

/**
 * The archive entry a figure reference points at.
 *
 * Our own archives are flat and match on the first pass. The second is for an archive someone
 * built by zipping a folder, where the entries carry a directory prefix the Markdown never had.
 * A reference that itself carries a path is not resolved, and is reported missing instead.
 */
const entryFor = (entries, name) =>
  entries.find(entry => entry.name === name)
  ?? entries.find(entry => baseName(entry.name) === name)

/**
 * @param {File} file a .md document, or a .zip holding one with its figures
 * @returns {Promise<{name: string, markdown: string, figures: Array<{name: string, file: File}>,
 *                    missing: string[]}>}
 *   `name` is the document's own file name, which is where its locale and slug are written.
 *   `figures` are the referenced ones that were in the archive, under the names the Markdown uses.
 *   `missing` are the referenced ones that were not, which is every figure of a bare .md.
 */
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

  // Driven by the document's references rather than by the archive's contents, so an entry the
  // Markdown does not name is left behind rather than stored under the document's stem, where
  // nothing would ever resolve it and only a delete of the whole guide would clear it.
  figureNames(markdown).forEach(name => {
    const entry = entryFor(rest, name)
    if (entry) figures.push({ name, file: new File([entry.data], name, { type: mimeFromName(name) }) })
    else missing.push(name)
  })

  return { name: document.name, markdown, figures, missing }
}
