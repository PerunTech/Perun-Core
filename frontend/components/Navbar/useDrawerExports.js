import { useCallback, useState } from 'react'
import { alertUserV2 } from '../../elements'
import { downloadBlob, downloadGuide } from '../../elements/guides/helpExport'
import { guideTitle } from '../../elements/guides/routeGuides'
import { loadGuideDocument } from '../../elements/guides/guideDocument'
import { openHelpWindow } from '../../elements/guides/helpWindow'

// A guide opened from the list is read through the panel's loader, so it exports as it would when open.
export const useDrawerExports = ({ svSession, active, doc, resolveImage, cache, fmt }) => {
  // One at a time, so a second click doesn't queue a duplicate download.
  const [exporting, setExporting] = useState(false)

  const failed = useCallback(
    () => alertUserV2({ type: 'error', title: fmt('perun.help_panel.export_failed') }),
    [fmt]
  )

  const exportGuide = useCallback(async (record, { raw, body, resolve }, form) => {
    setExporting(true)
    try {
      await downloadGuide(form, record.fileName, {
        title: guideTitle(record), raw, body, resolveUrl: resolve,
      })
    } catch (err) {
      console.error(err)
      failed()
    } finally {
      setExporting(false)
    }
  }, [failed])

  const savePdf = useCallback(async () => {
    if (!active || !doc.pdfUrl) return
    try {
      downloadBlob(active.fileName, await (await fetch(doc.pdfUrl)).blob())
    } catch (err) {
      console.error(err)
      failed()
    }
  }, [active, doc.pdfUrl, failed])

  const exportActive = useCallback((form) => {
    if (active) exportGuide(active, { raw: doc.raw, body: doc.body, resolve: resolveImage }, form)
  }, [active, doc.raw, doc.body, resolveImage, exportGuide])

  const openWindow = useCallback(() => {
    if (!active) return
    const options = {
      title: guideTitle(active),
      body: doc.body,
      resolveImage,
      actions: [
        { label: fmt('perun.help_panel.download_pdf'), onClick: () => exportActive('pdf') },
        { label: fmt('perun.help_panel.download_source'), onClick: () => exportActive('source') },
      ],
    }
    if (!openHelpWindow(active, options)) {
      alertUserV2({ type: 'warning', title: fmt('perun.help_panel.popup_blocked') })
    }
  }, [active, doc.body, resolveImage, fmt, exportActive])

  const exportRecord = useCallback(async (event, record, form) => {
    event.stopPropagation()
    try {
      const { raw, body, resolveUrl } = await loadGuideDocument(svSession, record, cache.current)
      await exportGuide(record, { raw, body, resolve: resolveUrl }, form)
    } catch (err) {
      console.error(err)
      failed()
    }
  }, [svSession, cache, failed, exportGuide])

  return { exporting, exportActive, exportRecord, savePdf, openWindow }
}
