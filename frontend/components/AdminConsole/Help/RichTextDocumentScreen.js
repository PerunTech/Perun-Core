import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Icon, alertUserV2, alertUserResponse } from '../../../elements'
import { RichTextEditor, RichTextView, richTextDocuments, useRichTextDocument } from '../../RichTextEditor'
import { PLUGIN_TABLE } from '../../../elements/guides/helpApi'

/** One rich text document open for editing, stored under its module's plugin row. */
const RichTextDocumentScreen = ({ module, name, title: givenTitle, fmt, onClose }) => {
  const doc = useRichTextDocument({ objectId: module.objectId, objectType: PLUGIN_TABLE, name })
  const savedTitle = doc.record?.notes?.title ?? givenTitle ?? ''
  const [title, setTitle] = useState(savedTitle)
  const [preview, setPreview] = useState(false)

  useEffect(() => { setTitle(savedTitle) }, [savedTitle])

  // Load and save failures alike, once each.
  useEffect(() => {
    if (doc.error) alertUserResponse({ response: doc.error })
  }, [doc.error])

  const dirty = doc.dirty || title !== savedTitle
  const canSave = !doc.loading && !doc.saving && (dirty || !doc.exists)
  const fileName = richTextDocuments.documentFileName(name)

  const save = async () => {
    try {
      await doc.save({ notes: { ...doc.record?.notes, title, module: module.id } })
      alertUserV2({ type: 'success', title: fmt('perun.admin_console.saved') })
    } catch {
      // Reported through doc.error.
    }
  }

  const leave = () => {
    if (!dirty) {
      onClose()
      return
    }
    alertUserV2({
      type: 'warning',
      title: fmt('perun.admin_console.rich_text_docs_leave_title'),
      showCancel: true,
      confirmButtonText: fmt('perun.admin_console.rich_text_docs_leave_confirm'),
      cancelButtonText: fmt('perun.help_editor.cancel'),
      onConfirm: onClose,
    })
  }

  const remove = async () => {
    try {
      await doc.remove()
      alertUserV2({ type: 'success', title: fmt('perun.admin_console.rich_text_docs_deleted') })
      onClose()
    } catch {
      // Reported through doc.error.
    }
  }

  const askDelete = () => alertUserV2({
    type: 'warning',
    title: fmt('perun.admin_console.rich_text_docs_delete_title'),
    message: `${title || name} (${fileName})`,
    showCancel: true,
    confirmButtonText: fmt('perun.admin_console.user_guides_delete_confirm'),
    cancelButtonText: fmt('perun.help_editor.cancel'),
    confirmButtonColor: '#a3342b',
    onConfirm: remove,
  })

  return (
    <React.Fragment>
      <div className='user-guides-actions'>
        <button type='button' className='md-btn md-btn--ghost' onClick={leave}>
          <Icon name='IconArrowLeft' size={16} stroke={1.7} />
          <span>{fmt('perun.admin_console.rich_text_docs_back')}</span>
        </button>
        <span className='user-guides-module'>
          <span>{fmt('perun.admin_console.user_guides_module')}</span>
          <strong>{module.title}</strong>
        </span>
        <span className='user-guides-module'>
          <span>{fmt('perun.admin_console.user_guides_file')}</span>
          <code>{fileName}</code>
        </span>
        <span style={{ flex: 1 }} />
        <button type='button' className='md-btn' aria-pressed={preview} onClick={() => setPreview(!preview)}>
          <Icon name={preview ? 'IconPencil' : 'IconEye'} size={16} stroke={1.7} />
          <span>{fmt(preview ? 'perun.admin_console.rich_text_docs_edit' : 'perun.admin_console.rich_text_docs_preview')}</span>
        </button>
        {doc.exists && (
          <button type='button' className='md-btn' onClick={askDelete} disabled={doc.saving}>
            <Icon name='IconTrash' size={16} stroke={1.7} />
            <span>{fmt('perun.admin_console.rich_text_docs_delete')}</span>
          </button>
        )}
        <button type='button' className='md-btn md-btn--primary' onClick={save} disabled={!canSave}>
          <Icon name='IconDeviceFloppy' size={16} stroke={1.7} />
          <span>{fmt(doc.saving ? 'perun.help_editor.saving' : 'perun.help_editor.save')}</span>
        </button>
      </div>

      <div className='user-guides-field user-guides-doc-title'>
        <label className='control-label' htmlFor='rich-text-doc-title'>{fmt('perun.help_editor.title')}</label>
        <input
          id='rich-text-doc-title'
          className='form-control'
          value={title}
          disabled={doc.loading || doc.saving}
          onChange={event => setTitle(event.target.value)}
        />
      </div>

      {preview ? (
        <div className='user-guides-rte-preview'>
          <RichTextView value={doc.value} resolveImage={doc.resolveImage} />
        </div>
      ) : (
        <RichTextEditor
          {...doc.editorProps}
          placeholder={fmt('perun.admin_console.rich_text_docs_placeholder')}
          minHeight={360}
          autoFocus
        />
      )}
    </React.Fragment>
  )
}

RichTextDocumentScreen.propTypes = {
  module: PropTypes.shape({ id: PropTypes.string, title: PropTypes.string, objectId: PropTypes.any }).isRequired,
  name: PropTypes.string.isRequired,
  title: PropTypes.string,
  fmt: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default RichTextDocumentScreen
