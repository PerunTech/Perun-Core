import { useCallback, useRef, useState } from 'react'
import { alertUserV2, alertUserResponse } from '../../../elements'
import {
  HELP_IMAGE, buildImageName, isPdfFile, parseDocName
} from '../../../elements/guides/helpNames'
import { saveHelpDoc, savePdfManual, uploadHelpFile } from '../../../elements/guides/helpApi'
import { clearHelpIndexCache, ownerModuleForRoute } from '../../../elements/guides/routeGuides'
import { readGuideUpload } from '../../../elements/guides/guideImport'
import { applyFrontMatter, parseFrontMatter } from '../../../elements/guides/frontMatter'

// A PDF manual is stored as it stands; a guide's source (.md or .zip) is stored as the editor would.
const GUIDE_SOURCE = /\.(md|zip)$/i

const metaOf = (record) => ({
  route: record.notes?.route ?? '',
  title: record.notes?.title ?? '',
  order: record.notes?.order,
  locale: record.locale,
  slug: record.slug,
})

export const useGuideUpload = ({ svSession, modules, anchorFor, reloadDocs, fmt }) => {
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)
  const [replacing, setReplacing] = useState(null)
  const [importing, setImporting] = useState(null)
  const [busy, setBusy] = useState(false)

  const inputRef = useRef(null)

  const close = useCallback(() => {
    setUploading(false)
    setFile(null)
    setReplacing(null)
    setImporting(null)
  }, [])

  // The anchor comes from the route, since a guide is only readable from its route's module.
  const store = useCallback(async (route, run) => {
    const module = ownerModuleForRoute(route, modules)
    const objectId = anchorFor(module)
    if (!objectId) {
      alertUserV2({ type: 'info', title: fmt('perun.admin_console.user_guides_no_anchor') })
      return
    }

    try {
      setBusy(true)
      await run(objectId, module)
      // The reader caches each module's index for the tab.
      clearHelpIndexCache()
      await reloadDocs()
      setBusy(false)
      close()
      alertUserV2({ type: 'success', title: fmt('perun.admin_console.saved') })
    } catch (err) {
      console.error(err)
      setBusy(false)
      alertUserResponse({ response: err })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, anchorFor, reloadDocs, close])

  const uploadManual = useCallback((chosen, meta) => store(meta.route, (objectId, module) =>
    savePdfManual(svSession, {
      objectId,
      locale: meta.locale,
      slug: meta.slug,
      file: chosen,
      // The module too: pickLocale keys by module and slug, so without it manuals of the same slug in
      // other modules would collide.
      notes: { route: meta.route, title: meta.title, order: meta.order, locale: meta.locale, module },
    })), [svSession, store])

  // The document is rewritten with the confirmed metadata, so an import onto another route doesn't
  // carry the old one in its front matter.
  const importGuide = useCallback(({ markdown, figures, meta }) => store(meta.route, async (objectId, module) => {
    const stem = `${meta.locale}_${meta.slug}`
    await saveHelpDoc(svSession, {
      objectId,
      locale: meta.locale,
      slug: meta.slug,
      markdown: applyFrontMatter(markdown, { route: meta.route, title: meta.title, order: meta.order }),
      notes: { route: meta.route, title: meta.title, order: meta.order, locale: meta.locale, module },
    })

    // One at a time: a burst of uploads on one object often fails with lock contention.
    for (const figure of figures) {
      await uploadHelpFile(svSession, {
        objectId,
        fileType: HELP_IMAGE,
        file: figure.file,
        fileName: buildImageName(stem, figure.name),
        notes: { doc: stem },
      })
    }
  }), [svSession, store])

  // Read before the form opens, so the form is filled from the document and a wrong file is refused
  // when picked. Figures the file didn't carry are reported, and the guide still imports.
  const startImport = useCallback(async (chosen) => {
    try {
      setBusy(true)
      const source = await readGuideUpload(chosen)
      setBusy(false)
      setUploading(true)
      setFile(chosen)
      setReplacing(null)
      setImporting({ ...source, ...parseFrontMatter(source.markdown), doc: parseDocName(source.name) })

      if (source.missing.length) {
        alertUserV2({
          type: 'info',
          title: fmt('perun.admin_console.user_guides_missing_figures'),
          message: source.missing.join(', '),
        })
      }
    } catch (err) {
      console.error(err)
      setBusy(false)
      alertUserV2({ type: 'info', title: fmt('perun.admin_console.user_guides_not_a_guide'), message: chosen.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The input is cleared first, so picking the same file again fires a change event.
  const pickFile = useCallback(async (event) => {
    const chosen = event.target.files?.[0] ?? null
    if (inputRef.current) inputRef.current.value = ''
    if (!chosen) return

    if (GUIDE_SOURCE.test(chosen.name)) {
      await startImport(chosen)
      return
    }

    if (!await isPdfFile(chosen)) {
      alertUserV2({ type: 'info', title: fmt('perun.admin_console.user_guides_not_pdf'), message: chosen.name })
      return
    }

    // A replacement keeps its route, title, locale and slug: changing them would move the document,
    // leaving the original behind.
    if (replacing) {
      const record = replacing
      setReplacing(null)
      await uploadManual(chosen, metaOf(record))
      return
    }

    setFile(chosen)
    setUploading(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replacing, startImport, uploadManual])

  const startUpload = useCallback(() => {
    setReplacing(null)
    setImporting(null)
    inputRef.current?.click()
  }, [])

  // No confirmation: a save writes a new version, so the old file is kept. The plain upload path
  // clears replacing, since a cancelled file dialog fires no event.
  const startReplace = useCallback((event, record) => {
    event.stopPropagation()
    setReplacing(record)
    inputRef.current?.click()
  }, [])

  const submit = useCallback((meta) => (importing
    ? importGuide({ ...importing, meta })
    : uploadManual(file, meta)), [importing, file, importGuide, uploadManual])

  return {
    uploading, file, importing, busy, inputRef,
    pickFile, startUpload, startReplace, cancel: close, submit,
  }
}
