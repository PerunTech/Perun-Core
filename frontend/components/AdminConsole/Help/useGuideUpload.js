import { useCallback, useRef, useState } from 'react'
import { alertUserV2, alertUserResponse } from '../../../elements'
import {
  HELP_IMAGE, buildImageName, isPdfFile, parseDocName
} from '../../../elements/guides/helpNames'
import { saveHelpDoc, savePdfManual, uploadHelpFile } from '../../../elements/guides/helpApi'
import { clearHelpIndexCache, ownerModuleForRoute } from '../../../elements/guides/routeGuides'
import { readGuideUpload } from '../../../elements/guides/guideImport'
import { applyFrontMatter, parseFrontMatter } from '../../../elements/guides/frontMatter'

/**
 * Taking a file in: a finished PDF manual, or a guide's source to be stored as if written here.
 *
 * One flow rather than two, because to an author the gesture is the same and only the file differs.
 * What the file is decides the rest, and that is settled here at the moment it is picked rather
 * than at the moment it is submitted, so a wrong file is refused while the author still remembers
 * choosing it.
 *
 * @param {object[]} modules   from listHelpModules, for resolving a route to its owning module
 * @param {Function} anchorFor module id to plugin row
 * @param {Function} reloadDocs re-reads the list once a write lands
 * @returns everything the screen needs to render and drive the flow
 */

// A manual arrives finished and is stored as it stands; a guide arrives as its source and is
// stored the way the editor would have stored it. The picker takes all three because to an author
// they are one gesture: this is the file, put it in.
const GUIDE_SOURCE = /\.(md|zip)$/i

/** The metadata a stored manual already carries, for a replacement that keeps all of it. */
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

  /**
   * The frame both writes share: resolve the anchor from the submitted route, write, refresh the
   * list, close, report.
   *
   * The anchor comes from the route rather than from anything on screen, because a guide is only
   * readable from the module its route belongs to. `run` is handed the resolved anchor and module
   * so it can write the notes that make the document routable.
   */
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
      // The navbar reader caches each module's index for the life of the tab, so a fresh write is
      // invisible to it until the cache is dropped.
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

  /** Stores an uploaded PDF against the module its route belongs to. */
  const uploadManual = useCallback((chosen, meta) => store(meta.route, (objectId, module) =>
    savePdfManual(svSession, {
      objectId,
      locale: meta.locale,
      slug: meta.slug,
      file: chosen,
      // The same notes a written guide carries, module included: pickLocale groups a document's
      // translations by module and slug, so a manual without one would share a key with every
      // other module's manual of that slug and all but one would be dropped from the list.
      notes: { route: meta.route, title: meta.title, order: meta.order, locale: meta.locale, module },
    })), [svSession, store])

  /**
   * Stores an imported guide as though the editor had just saved it.
   *
   * The form is the authority on the routing metadata rather than the file, so the document is
   * rewritten with what was confirmed on screen. Without that a guide imported onto a different
   * route would carry the old one in its front matter and export it back out again.
   */
  const importGuide = useCallback(({ markdown, figures, meta }) => store(meta.route, async (objectId, module) => {
    const stem = `${meta.locale}_${meta.slug}`
    await saveHelpDoc(svSession, {
      objectId,
      locale: meta.locale,
      slug: meta.slug,
      markdown: applyFrontMatter(markdown, { route: meta.route, title: meta.title, order: meta.order }),
      notes: { route: meta.route, title: meta.title, order: meta.order, locale: meta.locale, module },
    })

    // Stored under the name the Markdown uses, which is what resolveImageRecord looks for. One
    // at a time rather than in parallel: the store answers a burst of uploads on one object with
    // a lock contention error often enough to matter.
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

  /**
   * Opens the metadata form on a guide read out of a .md or an archive.
   *
   * The file is read before the form is shown so the form can be filled from what the document
   * says about itself, and so a file that is not a guide is refused at the point it was picked
   * rather than at the point it was submitted.
   *
   * Figures the document names but the file did not carry are reported rather than silently
   * dropped: the guide still imports, and the author is told which references will not resolve.
   * That is every figure of a bare .md, which is the honest answer to importing one.
   */
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

  /**
   * What the picked file turns out to be decides where it goes.
   *
   * The input is cleared first so choosing the same file twice fires a change event again; without
   * it, cancelling an upload and re-picking the same manual would do nothing. The type is checked
   * here rather than left to `accept`, which every file dialog offers a way past: a manual that is
   * not a PDF uploads happily and fails only when a reader opens it.
   */
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

    // A replacement asks nothing further: the route, title, locale and slug are the ones the
    // manual already answers on, and editing them here would move the document rather than
    // replace it, leaving the original behind under the old name.
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

  /**
   * Swaps the file behind an uploaded manual.
   *
   * No confirmation, because a save writes a new version rather than overwriting one: the previous
   * file is still stored if the new one turns out to be wrong. The plain upload path clears
   * `replacing` for the opposite reason, that cancelling a file dialog fires no event at all,
   * which would otherwise leave the next upload silently replacing this row.
   */
  const startReplace = useCallback((event, record) => {
    event.stopPropagation()
    setReplacing(record)
    inputRef.current?.click()
  }, [])

  /** What the dialog's form submits, whichever of the two the file turned out to be. */
  const submit = useCallback((meta) => (importing
    ? importGuide({ ...importing, meta })
    : uploadManual(file, meta)), [importing, file, importGuide, uploadManual])

  return {
    uploading, file, importing, busy, inputRef,
    pickFile, startUpload, startReplace, cancel: close, submit,
  }
}
