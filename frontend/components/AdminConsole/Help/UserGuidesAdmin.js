import React from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { Icon, alertUserV2, alertUserResponse } from '../../../elements'
import { MarkdownEditor } from '../../MarkdownEditor'
import AdminConsoleHelpButton from './AdminConsoleHelpButton'
import GuidesTable from './GuidesTable'
import GuideUploadDialog from './GuideUploadDialog'
import { useGuideExport } from './useGuideExport'
import { useGuideFigures } from './useGuideFigures'
import { useGuideRoutes } from './useGuideRoutes'
import { useGuideStore } from './useGuideStore'
import { useGuideUpload } from './useGuideUpload'
import Loading from '../../Loading/Loading'
import { PDF_KIND } from '../../../elements/guides/helpNames'
import {
  createBlobCache, deleteHelpDoc, fetchHelpText, saveHelpDoc,
} from '../../../elements/guides/helpApi'
import { clearHelpIndexCache, ownerModuleForRoute } from '../../../elements/guides/routeGuides'

const { useReducer, useEffect, useRef, useMemo } = React

// No trailing blank line: the fence regex takes one newline, so a second opens the editor on an empty
// line. The route is filled in to match the dropdown's default, which the anchor is derived from.
const blankDoc = (route) => `---\nroute: ${route}\ntitle: \norder: 1\n---\n`

const UserGuidesAdmin = (props) => {
  const intl = useIntl()
  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id })

  const initialState = {
    loading: false, saving: false, editing: null,
  }
  const reducer = (currState, update) => ({ ...currState, ...update })
  const [{
    loading, saving, editing,
  }, setState] = useReducer(reducer, initialState)

  const cache = useRef(createBlobCache())
  // Object URLs stay alive until revoked.
  useEffect(() => {
    const held = cache.current
    return () => held.revokeAll()
  }, [])

  const { svSession } = props

  const { modules, docs, locales, booting, anchorFor, reloadDocs } = useGuideStore(svSession, fmt)
  const upload = useGuideUpload({ svSession, modules, anchorFor, reloadDocs, fmt })

  const busy = saving || upload.busy

  // The anchor follows the route: a guide is only readable from the module that owns it.
  const editingModule = useMemo(
    () => (editing ? ownerModuleForRoute(editing.route, modules) : null),
    [editing, modules]
  )

  const { routes, moduleLabel } = useGuideRoutes(modules, docs, props.routeRegistry, fmt)
  const { resolveImage, uploadImage } = useGuideFigures({
    svSession, editing, editingModule, anchorFor, cache, fmt,
  })
  const { exporting, exportDoc, exportEditing } = useGuideExport({
    svSession, editing, resolveImage, cache,
  })

  const openDoc = async (record) => {
    // A PDF has nothing for the editor to open, so say so rather than leave the row dead.
    if (record.kind === PDF_KIND) {
      alertUserV2({
        type: 'info',
        title: fmt('perun.admin_console.user_guides_pdf_not_editable'),
        message: record.fileName,
      })
      return
    }
    try {
      setState({ loading: true })
      const markdown = await fetchHelpText(svSession, record)
      setState({
        // The stored record, not the form, so a slug renamed on screen still deletes the opened file.
        editing: {
          value: markdown,
          locale: record.locale,
          slug: record.slug,
          route: record.notes?.route ?? '',
          record,
        },
        loading: false,
      })
    } catch (err) {
      console.error(err)
      setState({ loading: false })
      alertUserResponse({ response: err })
    }
  }

  const newDoc = () => setState({
    editing: {
      value: blankDoc(routes[0]?.value ?? ''),
      locale: locales[0]?.value ?? '',
      slug: '',
      route: routes[0]?.value ?? '',
    },
  })

  const handleSave = async ({ document, locale, slug, meta }) => {
    // From the submitted route, so a save can't land on a stale anchor.
    const module = ownerModuleForRoute(meta.route, modules)
    const objectId = anchorFor(module)
    if (!objectId) return
    try {
      setState({ saving: true })
      await saveHelpDoc(svSession, {
        objectId,
        locale,
        slug,
        markdown: document,
        notes: { route: meta.route, title: meta.title, order: meta.order, locale, module },
      })
      // The reader caches each module's index for the tab.
      clearHelpIndexCache()
      await reloadDocs()
      setState({ saving: false, editing: null })
      alertUserV2({ type: 'success', title: fmt('perun.admin_console.saved') })
    } catch (err) {
      console.error(err)
      setState({ saving: false })
      alertUserResponse({ response: err })
    }
  }

  // Removes every version and the document's own figures, so it can't come back from history.
  const askDelete = (doc) => {
    alertUserV2({
      type: 'warning',
      title: fmt('perun.admin_console.user_guides_delete_title'),
      message: `${doc.notes?.title || doc.slug} (${doc.fileName})`,
      showCancel: true,
      confirmButtonText: fmt('perun.admin_console.user_guides_delete_confirm'),
      cancelButtonText: fmt('perun.help_editor.cancel'),
      confirmButtonColor: '#a3342b',
      onConfirm: () => removeDoc(doc),
    })
  }

  // The row itself opens the editor, hence stopPropagation.
  const confirmDelete = (event, doc) => {
    event.stopPropagation()
    askDelete(doc)
  }

  const removeDoc = async (doc) => {
    const objectId = anchorFor(doc.module)
    if (!objectId) return
    try {
      setState({ saving: true })
      await deleteHelpDoc(svSession, { objectId, fileName: doc.fileName, kind: doc.kind })
      clearHelpIndexCache()
      await reloadDocs()
      setState({ saving: false, editing: null })
      alertUserV2({ type: 'success', title: fmt('perun.admin_console.user_guides_deleted') })
    } catch (err) {
      console.error(err)
      setState({ saving: false })
      alertUserResponse({ response: err })
    }
  }

  const title = { id: 'perun.admin_console.user_guides', defaultMessage: 'perun.admin_console.user_guides' }

  const header = (
    <div className='admin-console-component-header'>
      <p>{fmt('perun.admin_console.user_guides')}</p>
      <AdminConsoleHelpButton title={title} />
    </div>
  )

  if (editing) {
    return (
      <React.Fragment>
        {header}
        <div className='user-guides-actions'>
          <button type='button' className='md-btn md-btn--ghost' onClick={() => setState({ editing: null })}>
            <Icon name='IconArrowLeft' size={16} stroke={1.7} />
            <span>{fmt('perun.admin_console.user_guides_back')}</span>
          </button>
          <span className='user-guides-module'>
            <span>{fmt('perun.admin_console.user_guides_module')}</span>
            <strong>{moduleLabel(editing.route)}</strong>
          </span>
        </div>
        <MarkdownEditor
          value={editing.value}
          locale={editing.locale}
          slug={editing.slug}
          locales={locales}
          routes={routes}
          uploadImage={uploadImage}
          resolveImage={resolveImage}
          onSave={handleSave}
          onCancel={() => setState({ editing: null })}
          onMetaChange={(meta) => setState({ editing: { ...editing, route: meta.route } })}
          onExport={exportEditing}
          onDelete={editing.record ? () => askDelete(editing.record) : undefined}
          saving={saving}
        />
        {exporting && <Loading />}
      </React.Fragment>
    )
  }

  return (
    <React.Fragment>
      {header}
      <div className='user-guides-actions'>
        <button type='button' className='md-btn md-btn--primary' onClick={newDoc} disabled={!modules.length}>
          <Icon name='IconPlus' size={16} stroke={1.7} />
          <span>{fmt('perun.admin_console.user_guides_new')}</span>
        </button>
        <button
          type='button'
          className='md-btn user-guides-upload-btn'
          onClick={upload.startUpload}
          disabled={!modules.length}
        >
          <Icon name='IconUpload' size={16} stroke={1.7} />
          <span>{fmt('perun.admin_console.user_guides_upload')}</span>
        </button>
      </div>

      <input
        ref={upload.inputRef}
        type='file'
        accept='application/pdf,.pdf,text/markdown,.md,application/zip,.zip'
        className='md-file-input'
        onChange={upload.pickFile}
      />

      {upload.uploading && upload.file && (
        <GuideUploadDialog
          file={upload.file}
          importing={upload.importing}
          routes={routes}
          locales={locales}
          saving={busy}
          fmt={fmt}
          intl={intl}
          onPickOther={() => upload.inputRef.current?.click()}
          onCancel={upload.cancel}
          onSubmit={upload.submit}
        />
      )}

      {(booting || loading || busy || exporting) && <Loading />}

      {!booting && !loading && !busy && !docs.length && (
        <p className='user-guides-empty'>{fmt('perun.admin_console.user_guides_empty')}</p>
      )}

      {!booting && !loading && !busy && docs.length > 0 && (
        <GuidesTable
          docs={docs}
          moduleLabel={moduleLabel}
          fmt={fmt}
          exporting={exporting}
          saving={busy}
          onOpen={openDoc}
          onExport={exportDoc}
          onReplace={upload.startReplace}
          onDelete={confirmDelete}
        />
      )}
    </React.Fragment>
  )
}

const mapStateToProps = state => ({
  svSession: state.security.svSession,
  // name -> <Route path=... />, kept by Router.js.
  routeRegistry: state.routes,
})

export default connect(mapStateToProps)(UserGuidesAdmin)
