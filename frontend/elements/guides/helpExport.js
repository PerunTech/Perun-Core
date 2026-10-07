import { figureNames } from './figureRefs'
import { loadPdfFigures, renderGuidePdf } from './guidePdf'
import { zipBlob } from './zip'

/**
 * The two forms a guide leaves the application in.
 *
 * A PDF is the form it is read and kept in: one file, figures included, that opens anywhere and
 * prints as it looks. An archive of the Markdown with its figures beside it is the form it is
 * edited and moved in, and is what an author uploads into another deployment.
 *
 * There is deliberately no single .md download. Markdown cannot carry an image, so such a file
 * either points at figures that are not next to it or inlines them as data: URIs, which a good half
 * of the Markdown viewers in use refuse to draw. Splitting the two jobs is what makes both work.
 */

/** Saves a blob to the reader's machine. */
export const downloadBlob = (fileName, blob) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Deferred: revoking in the same tick can beat the download starting in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** en_US_searching-holdings.md and a suffix, to the file the download actually writes. */
const named = (fileName, suffix) => `${(fileName ?? 'guide').replace(/\.md$/i, '')}.${suffix}`

/**
 * Downloads the guide's source: the Markdown exactly as stored, front matter and all, with every
 * figure it references stored beside it under the name the Markdown uses.
 *
 * Flat rather than foldered, so the extracted directory is a working copy of the document: the
 * references resolve as they stand and the guide renders in any Markdown viewer without being
 * rewritten first.
 *
 * A figure that cannot be read is left out rather than failing the download. The archive is still
 * the document, and the reference to the figure that did not come is visible in it.
 *
 * @param {string} fileName  the stored name, e.g. en_US_searching-holdings.md
 * @param {string} markdown  the document as stored, front matter included
 * @param {(name: string) => string|null} resolveUrl  figure name to a URL this document can fetch
 */
const downloadGuideArchive = async (fileName, markdown, resolveUrl) => {
  const source = markdown ?? ''
  const entries = [{ name: named(fileName, 'md'), data: source }]

  await Promise.all(figureNames(source).map(async (name) => {
    try {
      const url = resolveUrl?.(name)
      if (url) entries.push({ name, data: await (await fetch(url)).blob() })
    } catch (err) {
      console.error(`Could not read the figure ${name}`, err)
    }
  }))

  downloadBlob(named(fileName, 'zip'), await zipBlob(entries))
}

/**
 * Downloads the guide as a PDF, laid out from the same Markdown the reader is shown.
 *
 * @param {string} fileName  the stored name, e.g. en_US_searching-holdings.md
 * @param {string} title     the guide's title, for the first page and the running footer
 * @param {string} body      the document with its front matter removed
 * @param {(name: string) => string|null} resolveUrl  figure name to a URL this document can fetch
 */
const downloadGuidePdf = async (fileName, { title, body, resolveUrl }) => {
  const figures = await loadPdfFigures(body, resolveUrl)
  downloadBlob(named(fileName, 'pdf'), await renderGuidePdf({ title, body, figures }))
}

/**
 * Downloads a guide in whichever of the two forms was asked for.
 *
 * The fork belongs here rather than at each surface. Which form the reader wants is the surface's
 * business; that a PDF is laid out from the body while an archive carries the document whole is
 * this module's, and it was being restated at three call sites that had no other reason to know it.
 *
 * @param {'pdf'|'source'} form
 * @param {string} raw   the document as stored, front matter included
 * @param {string} body  the same document with its front matter removed
 */
export const downloadGuide = (form, fileName, { title, raw, body, resolveUrl }) => (
  form === 'pdf'
    ? downloadGuidePdf(fileName, { title, body, resolveUrl })
    : downloadGuideArchive(fileName, raw, resolveUrl)
)
