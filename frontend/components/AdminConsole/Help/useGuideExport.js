import { useCallback, useState } from 'react'
import { alertUserResponse } from '../../../elements'
import { downloadGuide } from '../../../elements/guides/helpExport'
import { loadGuideDocument } from '../../../elements/guides/guideDocument'
import { parseFrontMatter } from '../../../elements/guides/frontMatter'

export const useGuideExport = ({ svSession, editing, resolveImage, cache }) => {
  const [exporting, setExporting] = useState(false)

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

  // What is on screen, not what is stored, with the editor's resolver, so an unsaved draft exports as it
  // previews.
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
