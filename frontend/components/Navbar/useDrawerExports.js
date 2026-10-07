import { useCallback, useState } from 'react'
import { alertUserV2 } from '../../elements'
import { downloadBlob, downloadGuide } from '../../elements/guides/helpExport'
import { guideTitle } from '../../elements/guides/routeGuides'
import { loadGuideDocument } from '../../elements/guides/guideDocument'
import { openHelpWindow } from '../../elements/guides/helpWindow'

/**
 * Taking a guide out of the drawer: as a PDF, as its source, or into a window of its own.
 *
 * All four actions want the same two things, the document and the figures it references, and
 * differ only in where they send them. The guide on screen already holds both; one opened straight
 * from the list does not, and is read through the same loader so it exports identically either way.
 *
 * @param {object} active the guide on screen, or null when the list is showing
 * @param {object} doc    the loaded document, for the guide that is open
 * @param {object} cache  a blob cache from createBlobCache
 */
export const useDrawerExports = ({ svSession, active, doc, resolveImage, cache, fmt }) => {
  // One guide at a time: a PDF of a long guide takes a moment to lay out, and a second click
  // while the first is still working would only queue a duplicate download.
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

  /**
   * Saves an uploaded manual as it stands.
   *
   * Nothing is rendered or repacked here, so this is a plain save of the blob the reader already
   * holds rather than anything the exporters need to be involved in.
   */
  const savePdf = useCallback(async () => {
    if (!active || !doc.pdfUrl) return
    try {
      downloadBlob(active.fileName, await (await fetch(doc.pdfUrl)).blob())
    } catch (err) {
      console.error(err)
      failed()
    }
  }, [active, doc.pdfUrl, failed])

  /** Exports the guide the panel is showing, whose body is already in hand. */
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

  /**
   * Exports a guide straight from the list, where its body has not been fetched yet.
   *
   * Read through the same loader the panel uses, so a guide exports identically whether or not it
   * happens to be the one open.
   */
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
