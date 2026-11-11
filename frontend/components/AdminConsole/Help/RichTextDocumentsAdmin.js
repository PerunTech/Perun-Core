import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Icon, alertUserV2, alertUserResponse } from '../../../elements'
import Loading from '../../Loading/Loading'
import { richTextDocuments } from '../../RichTextEditor'
import { PLUGIN_TABLE } from '../../../elements/guides/helpApi'
import { downloadBlob } from '../../../elements/guides/helpExport'
import { fetchFileBlob } from '../../../functions/fileStore'
import RichTextDocumentScreen from './RichTextDocumentScreen'

// What documentStore accepts, less what reads badly as a file name.
const DOCUMENT_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9.-]|_(?!_))*$/

const anchorOf = (module) => ({ objectId: module.objectId, objectType: PLUGIN_TABLE })

const savedAt = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : (value ?? '')
}

/**
 * The rich text side of the User guides section: documents stored on the same plugin rows as the
 * guides, through the useRichTextDocument hook the modules use, and never shown by the Help button.
 */
const RichTextDocumentsAdmin = ({ svSession, modules, booting, fmt, formatSwitch }) => {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  const [opened, setOpened] = useState(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const perModule = await Promise.all(modules.map(async (module) => {
      try {
        const records = await richTextDocuments.listRichTextDocuments(svSession, anchorOf(module))
        return records.map(record => ({ ...record, module }))
      } catch (err) {
        console.error(`Could not read rich text documents for ${module.id}`, err)
        return []
      }
    }))
    setDocs(perModule.flat())
    setLoading(false)
  }, [svSession, modules])

  useEffect(() => {
    if (svSession && modules.length) loadDocs()
  }, [svSession, modules.length, loadDocs])

  const draftModule = draft ? modules.find(module => module.id === draft.moduleId) : null
  const draftProblem = draft && (
    !DOCUMENT_NAME.test(draft.name) ? 'perun.admin_console.rich_text_docs_name_invalid'
      : docs.some(doc => doc.module.id === draft.moduleId && doc.name === draft.name)
        ? 'perun.admin_console.rich_text_docs_name_taken'
        : null
  )

  const create = (event) => {
    event.preventDefault()
    if (draftProblem || !draftModule) return
    setOpened({ module: draftModule, name: draft.name, title: draft.title })
    setDraft(null)
  }

  const download = async (event, doc) => {
    event.stopPropagation()
    try {
      downloadBlob(doc.fileName, await fetchFileBlob(svSession, doc))
    } catch (err) {
      console.error(err)
      alertUserResponse({ response: err })
    }
  }

  const remove = async (doc) => {
    try {
      setBusy(true)
      await richTextDocuments.deleteRichTextDocument(svSession, anchorOf(doc.module), doc.name)
      await loadDocs()
      alertUserV2({ type: 'success', title: fmt('perun.admin_console.rich_text_docs_deleted') })
    } catch (err) {
      console.error(err)
      alertUserResponse({ response: err })
    } finally {
      setBusy(false)
    }
  }

  const askDelete = (event, doc) => {
    event.stopPropagation()
    alertUserV2({
      type: 'warning',
      title: fmt('perun.admin_console.rich_text_docs_delete_title'),
      message: `${doc.notes?.title || doc.name} (${doc.fileName})`,
      showCancel: true,
      confirmButtonText: fmt('perun.admin_console.user_guides_delete_confirm'),
      cancelButtonText: fmt('perun.help_editor.cancel'),
      confirmButtonColor: '#a3342b',
      onConfirm: () => remove(doc),
    })
  }

  if (opened) {
    return (
      <RichTextDocumentScreen
        module={opened.module}
        name={opened.name}
        title={opened.title}
        fmt={fmt}
        onClose={() => {
          setOpened(null)
          loadDocs()
        }}
      />
    )
  }

  const quiet = !booting && !loading && !busy

  return (
    <React.Fragment>
      <div className='user-guides-actions'>
        <button
          type='button'
          className='md-btn md-btn--primary'
          onClick={() => setDraft({ moduleId: modules[0]?.id ?? '', name: '', title: '' })}
          disabled={!modules.length || Boolean(draft)}
        >
          <Icon name='IconPlus' size={16} stroke={1.7} />
          <span>{fmt('perun.admin_console.rich_text_docs_new')}</span>
        </button>
        {formatSwitch}
      </div>

      {draft && (
        <form className='user-guides-upload user-guides-new-doc' onSubmit={create}>
          <div className='user-guides-field'>
            <label className='control-label' htmlFor='rich-text-doc-module'>{fmt('perun.admin_console.user_guides_module')}</label>
            <select
              id='rich-text-doc-module'
              className='form-control'
              value={draft.moduleId}
              onChange={event => setDraft({ ...draft, moduleId: event.target.value })}
            >
              {modules.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}
            </select>
          </div>
          <div className='user-guides-field'>
            <label className='control-label' htmlFor='rich-text-doc-name'>{fmt('perun.admin_console.rich_text_docs_name')}</label>
            <input
              id='rich-text-doc-name'
              className='form-control'
              value={draft.name}
              autoFocus
              aria-invalid={Boolean(draft.name && draftProblem)}
              onChange={event => setDraft({ ...draft, name: event.target.value.trim() })}
            />
            {draft.name && draftProblem && <ul className='error-detail'><li>{fmt(draftProblem)}</li></ul>}
          </div>
          <div className='user-guides-field user-guides-field--wide'>
            <label className='control-label' htmlFor='rich-text-doc-title'>{fmt('perun.help_editor.title')}</label>
            <input
              id='rich-text-doc-title'
              className='form-control'
              value={draft.title}
              onChange={event => setDraft({ ...draft, title: event.target.value })}
            />
          </div>
          <div className='user-guides-new-doc-actions'>
            <button type='button' className='md-btn md-btn--ghost' onClick={() => setDraft(null)}>
              {fmt('perun.help_editor.cancel')}
            </button>
            <button type='submit' className='md-btn md-btn--primary' disabled={Boolean(draftProblem)}>
              {fmt('perun.admin_console.rich_text_docs_create')}
            </button>
          </div>
        </form>
      )}

      {(booting || loading || busy) && <Loading />}

      {quiet && !docs.length && (
        <p className='user-guides-empty'>{fmt('perun.admin_console.rich_text_docs_empty')}</p>
      )}

      {quiet && docs.length > 0 && (
        <table className='user-guides-table'>
          <thead>
            <tr>
              <th>{fmt('perun.admin_console.user_guides_module')}</th>
              <th>{fmt('perun.help_editor.title')}</th>
              <th>{fmt('perun.admin_console.user_guides_file')}</th>
              <th>{fmt('perun.admin_console.rich_text_docs_saved_at')}</th>
              <th aria-label={fmt('perun.admin_console.rich_text_docs_delete')} />
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => (
              <tr
                key={`${doc.module.id}/${doc.name}`}
                onClick={() => setOpened({ module: doc.module, name: doc.name, title: doc.notes?.title ?? '' })}
              >
                <td>{doc.module.title}</td>
                <td>{doc.notes?.title || doc.name}</td>
                <td><code>{doc.fileName}</code></td>
                <td>{savedAt(doc.fileDate)}</td>
                <td className='user-guides-row-actions'>
                  <button
                    type='button'
                    className='user-guides-action'
                    title={fmt('perun.admin_console.rich_text_docs_download')}
                    aria-label={fmt('perun.admin_console.rich_text_docs_download')}
                    onClick={event => download(event, doc)}
                  >
                    <Icon name='IconDownload' size={17} stroke={1.6} />
                  </button>
                  <button
                    type='button'
                    className='user-guides-delete'
                    title={fmt('perun.admin_console.rich_text_docs_delete')}
                    aria-label={fmt('perun.admin_console.rich_text_docs_delete')}
                    onClick={event => askDelete(event, doc)}
                  >
                    <Icon name='IconTrash' size={17} stroke={1.6} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </React.Fragment>
  )
}

RichTextDocumentsAdmin.propTypes = {
  svSession: PropTypes.string,
  modules: PropTypes.array.isRequired,
  booting: PropTypes.bool,
  fmt: PropTypes.func.isRequired,
  formatSwitch: PropTypes.node,
}

export default RichTextDocumentsAdmin
