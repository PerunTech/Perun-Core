import { useCallback, useEffect, useMemo, useState } from 'react'
import { HELP_IMAGE, buildImageName, displayImageName } from '../../../elements/guides/helpNames'
import { uploadHelpFile } from '../../../elements/guides/helpApi'
import { figureResolver, loadImageIndex } from '../../../elements/guides/routeGuides'

// Prefetched, since the preview asks for figures synchronously; re-read whenever the document or its
// module changes, so the last guide's figures can't resolve in the next.
export const useGuideFigures = ({ svSession, editing, editingModule, anchorFor, cache, fmt }) => {
  const [imageUrls, setImageUrls] = useState({})

  useEffect(() => {
    setImageUrls({})
    // No session is a logout in progress; asking anyway 401s into the interceptor's alert.
    if (!editing || !svSession) return undefined

    const objectId = anchorFor(editingModule)
    if (!objectId) return undefined
    let cancelled = false

    const loadImages = async () => {
      try {
        const records = await loadImageIndex(svSession, objectId)
        if (cancelled) return
        const stem = `${editing.locale}_${editing.slug}`
        // Its own figures, plus the stemless ones every translation shares.
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

  // figureResolver, so the preview resolves both spellings the reader does.
  const resolveImage = useMemo(() => figureResolver(imageUrls), [imageUrls])

  // Stored under the display name the editor already wrote into the Markdown.
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
