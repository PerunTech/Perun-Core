import { guideFormat } from './guideFormat'
import { renderHtmlGuidePdf } from './guideHtmlPdf'
import { loadPdfFigures, renderGuidePdf } from './guidePdf'
import { DOC_KIND, HTML_KIND, docStem, kindExtension } from './helpNames'
import { zipBlob } from './zip'

// No plain source download: a guide's file can't carry its figures, so it leaves as a PDF or a .zip.

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

const named = (fileName, suffix) => `${docStem(fileName ?? '') || 'guide'}.${suffix}`

// Flat, so the extracted folder renders as it stands. A figure that can't be read is left out.
const downloadGuideArchive = async (fileName, kind, { raw, body, resolveUrl }) => {
  const entries = [{ name: named(fileName, kindExtension(kind)), data: raw ?? '' }]

  await Promise.all(guideFormat(kind).figureNames(body).map(async (name) => {
    try {
      const url = resolveUrl?.(name)
      if (url) entries.push({ name, data: await (await fetch(url)).blob() })
    } catch (err) {
      console.error(`Could not read the figure ${name}`, err)
    }
  }))

  downloadBlob(named(fileName, 'zip'), await zipBlob(entries))
}

const downloadGuidePdf = async (fileName, kind, { title, body, resolveUrl }) => {
  const figures = await loadPdfFigures(guideFormat(kind).figureNames(body), resolveUrl)
  const blob = kind === HTML_KIND
    ? await renderHtmlGuidePdf({ title, html: body, figures })
    : await renderGuidePdf({ title, body, figures })
  downloadBlob(named(fileName, 'pdf'), blob)
}

export const downloadGuide = (form, fileName, { kind = DOC_KIND, title, raw, body, resolveUrl }) => (
  form === 'pdf'
    ? downloadGuidePdf(fileName, kind, { title, body, resolveUrl })
    : downloadGuideArchive(fileName, kind, { raw, body, resolveUrl })
)
