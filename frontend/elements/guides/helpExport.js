import { figureNames } from './figureRefs'
import { loadPdfFigures, renderGuidePdf } from './guidePdf'
import { zipBlob } from './zip'

// No plain .md download: Markdown can't carry its figures, so a guide leaves as a PDF or a .zip.

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

const named = (fileName, suffix) => `${(fileName ?? 'guide').replace(/\.md$/i, '')}.${suffix}`

// Flat, so the extracted folder renders as it stands. A figure that can't be read is left out.
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

const downloadGuidePdf = async (fileName, { title, body, resolveUrl }) => {
  const figures = await loadPdfFigures(body, resolveUrl)
  downloadBlob(named(fileName, 'pdf'), await renderGuidePdf({ title, body, figures }))
}

export const downloadGuide = (form, fileName, { title, raw, body, resolveUrl }) => (
  form === 'pdf'
    ? downloadGuidePdf(fileName, { title, body, resolveUrl })
    : downloadGuideArchive(fileName, raw, resolveUrl)
)
