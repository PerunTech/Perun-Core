import { useCallback, useState } from 'react'
import { alertUserResponse } from '../../../elements'
import { downloadGuide } from '../../../elements/guides/helpExport'
import { loadGuideDocument } from '../../../elements/guides/guideDocument'
import { parseFrontMatter } from '../../../elements/guides/frontMatter'

/**
 * Taking a guide out of the Admin Console, stored or still being written.
 *
 * @param {object}   editing      the document open in the editor, for naming its export
 * @param {Function} resolveImage the editor's stored figures, when the draft brings none of its own
 * @param {object}   cache        a blob cache from createBlobCache
 */
export const useGuideExport = ({ svSession, editing, resolveImage, cache }) => {
  const [exporting, setExporting] = useState(false)

  /**
   * Exports one stored guide, as a PDF to read or as its source to edit.
   *
   * The figures are read the way the reader reads them, so the PDF carries its screenshots rather
   * than a column of gaps and the archive carries the files the Markdown names.
   */
  const exportDoc = useCallback(async (event, record, form) => {
    event.stopPropagation()
    setExporting(true)
    try {
      const { raw, body, resolveUrl } = await loadGuideDocument(svSession, record, cache.current)
      await downloadGuide(form, record.fileName, {
        title: record.notes?.title || record.slug, raw, body, resolveUrl,
      })
    } catch (err) {
      console.error(err)
      alertUserResponse({ response: err })
    } finally {
      setExporting(false)
    }
  }, [svSession, cache])

  /**
   * Exports what is on screen rather than what is stored, so an author can take a draft away before
   * committing it. The editor hands over the recombined document and its own resolver, which covers
   * figures dropped in this session and not yet uploaded, so a draft exports as it previews.
   */
  const exportEditing = useCallback(async (form, document, resolveFigure) => {
    const fileName = `${editing.locale}_${editing.slug || 'untitled'}.md`
    setExporting(true)
    try {
      const { meta, body } = parseFrontMatter(document)
      await downloadGuide(form, fileName, {
        title: meta.title || editing.slug,
        raw: document,
        body,
        resolveUrl: resolveFigure ?? resolveImage,
      })
    } catch (err) {
      console.error(err)
      alertUserResponse({ response: err })
    } finally {
      setExporting(false)
    }
  }, [editing, resolveImage])

  return { exporting, exportDoc, exportEditing }
}
