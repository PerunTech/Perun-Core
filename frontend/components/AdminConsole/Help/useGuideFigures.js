import { useCallback, useEffect, useMemo, useState } from 'react'
import { HELP_IMAGE, buildImageName, displayImageName } from '../../../elements/guides/helpNames'
import { uploadHelpFile } from '../../../elements/guides/helpApi'
import { figureResolver, loadImageIndex } from '../../../elements/guides/routeGuides'

/**
 * The figures behind the document being edited: the stored ones, and the writer for new ones.
 *
 * Prefetched on entering the editor rather than resolved one at a time, because the editor asks
 * for them synchronously while rendering the preview and has nowhere to await. Cleared and re-read
 * whenever the document or its module changes, so a figure from the guide just closed can never
 * resolve inside the next one.
 *
 * @param {object}   editing       the document open in the editor, or null
 * @param {string}   editingModule the module its route belongs to, which owns its figures
 * @param {Function} anchorFor     module id to plugin row
 * @param {object}   cache         a blob cache from createBlobCache
 * @returns {{resolveImage: Function, uploadImage: Function}} the two callbacks the editor takes
 */
export const useGuideFigures = ({ svSession, editing, editingModule, anchorFor, cache, fmt }) => {
  const [imageUrls, setImageUrls] = useState({})

  // Fetched only for the module being edited, and only on entering the editor, so opening the
  // section costs one request per module rather than two.
  useEffect(() => {
    setImageUrls({})
    // No session is a logout in progress with the editor still open. Asking anyway 401s, and the
    // global interceptor alerts on that however quietly the catch below handles it.
    if (!editing || !svSession) return undefined

    const objectId = anchorFor(editingModule)
    if (!objectId) return undefined
    let cancelled = false

    const loadImages = async () => {
      try {
        const records = await loadImageIndex(svSession, objectId)
        if (cancelled) return
        const stem = `${editing.locale}_${editing.slug}`
        // The document's own figures, plus the ones carrying no document stem at all, which are
        // shared by every translation.
        const mine = records.filter(img => img.fileName.startsWith(`${stem}__`) || !img.fileName.includes('__'))
        const pairs = await Promise.all(mine.map(async record => [
          displayImageName(record.fileName),
          await cache.current.get(svSession, record),
        ]))
        if (!cancelled) setImageUrls(Object.fromEntries(pairs))
      } catch (err) {
        console.error(err)
      }
    }

    loadImages()
    return () => { cancelled = true }
  }, [editing, editingModule, svSession, anchorFor, cache])

  // Through figureResolver rather than a plain lookup, so the editor's preview resolves the
  // same two spellings the reader does: the display name the editor writes into the Markdown,
  // and the stored name a hand-written or imported document may carry instead.
  const resolveImage = useMemo(() => figureResolver(imageUrls), [imageUrls])

  /**
   * Called by the editor on save, once per figure the document still references.
   *
   * The editor has already chosen a non-colliding display name and written it into the Markdown,
   * so the file is stored under that name rather than under the dropped file's own.
   */
  const uploadImage = useCallback(async (file, { locale, slug, name }) => {
    const objectId = anchorFor(editingModule)
    if (!objectId) throw new Error(fmt('perun.admin_console.user_guides_no_anchor'))

    await uploadHelpFile(svSession, {
      objectId,
      fileType: HELP_IMAGE,
      file,
      fileName: buildImageName(`${locale}_${slug}`, name || file.name),
      notes: { doc: `${locale}_${slug}` },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svSession, editingModule, anchorFor])

  return { resolveImage, uploadImage }
}
