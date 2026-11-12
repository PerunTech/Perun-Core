import React from 'react';
import PropTypes from 'prop-types';
import { Icon } from '../../elements';

const MarkdownToolbar = ({
  fmt, formId, richText = false, onWrap, onPrefix, onInsertImage, canInsertImage, pendingCount,
  onExport, showPreview, onTogglePreview, stats, onCancel, onDelete, saving, uploading,
}) => {
  const tool = (icon, labelId, action, disabled = false, variant = '') => (
    <button
      type='button'
      className={variant ? `md-tool ${variant}` : 'md-tool'}
      title={fmt(labelId)}
      aria-label={fmt(labelId)}
      disabled={disabled}
      onClick={action}
    >
      <Icon name={icon} size={17} stroke={1.6} />
    </button>
  );

  return (
    <div className='md-toolbar'>
      {!richText && (
        <div className='md-tool-group'>
          {tool('IconHeading', 'perun.help_editor.heading', () => onPrefix('## '))}
          {tool('IconBold', 'perun.help_editor.bold', () => onWrap('**', '**', fmt('perun.help_editor.bold')))}
          {tool('IconItalic', 'perun.help_editor.italic', () => onWrap('_', '_', fmt('perun.help_editor.italic')))}
          {tool('IconCode', 'perun.help_editor.code', () => onWrap('`', '`', 'code'))}
          {tool('IconLink', 'perun.help_editor.link', () => onWrap('[', '](https://)', fmt('perun.help_editor.link')))}
        </div>
      )}

      {!richText && (
        <div className='md-tool-group'>
          {tool('IconList', 'perun.help_editor.bullet_list', () => onPrefix('- '))}
          {tool('IconListNumbers', 'perun.help_editor.numbered_list', () => onPrefix('1. '))}
          {tool('IconQuote', 'perun.help_editor.quote', () => onPrefix('> '))}
        </div>
      )}

      <div className='md-tool-group'>
        {!richText && (
          <button
            type='button'
            className='md-tool md-tool--wide'
            onClick={onInsertImage}
            disabled={!canInsertImage}
          >
            <Icon name='IconPhotoPlus' size={17} stroke={1.6} />
            <span>{fmt('perun.help_editor.insert_image')}</span>
          </button>
        )}
        {pendingCount > 0 && (
          <span className='md-pending' title={fmt('perun.help_editor.pending_hint')}>
            {pendingCount} {fmt('perun.help_editor.pending')}
          </span>
        )}
      </div>

      <div className='md-tool-group md-tool-group--end'>
        {/* At the head of this group, away from Save: a delete takes every stored version. */}
        {onDelete && tool('IconTrash', 'perun.admin_console.user_guides_delete', onDelete, saving || uploading, 'md-tool--danger')}
        {onExport && tool('IconFileTypePdf', 'perun.help_panel.download_pdf', () => onExport('pdf'))}
        {onExport && tool('IconFileZip', 'perun.help_panel.download_source', () => onExport('source'))}
        {!richText && tool(showPreview ? 'IconEyeOff' : 'IconEye', 'perun.help_editor.toggle_preview', onTogglePreview)}
        <span className='md-stats'>{stats}</span>
        {onCancel && (
          <button type='button' className='md-btn md-btn--ghost' onClick={onCancel}>
            {fmt('perun.help_editor.cancel')}
          </button>
        )}
        {/* Submits the metadata form by id, so RJSF validates first. */}
        <button
          type='submit'
          form={formId}
          className='md-btn md-btn--primary'
          disabled={saving || uploading}
        >
          <Icon name={saving || uploading ? 'IconLoader2' : 'IconDeviceFloppy'} size={17} stroke={1.6} />
          <span>{fmt(uploading ? 'perun.help_editor.uploading' : saving ? 'perun.help_editor.saving' : 'perun.help_editor.save')}</span>
        </button>
      </div>
    </div>
  );
};

MarkdownToolbar.propTypes = {
  fmt: PropTypes.func.isRequired,
  formId: PropTypes.string.isRequired,
  // Rich text editing has its own tools, so only the document's own actions are shown.
  richText: PropTypes.bool,
  onWrap: PropTypes.func.isRequired,
  onPrefix: PropTypes.func.isRequired,
  onInsertImage: PropTypes.func.isRequired,
  canInsertImage: PropTypes.bool,
  pendingCount: PropTypes.number,
  onExport: PropTypes.func,
  showPreview: PropTypes.bool,
  onTogglePreview: PropTypes.func.isRequired,
  stats: PropTypes.string,
  onCancel: PropTypes.func,
  onDelete: PropTypes.func,
  saving: PropTypes.bool,
  uploading: PropTypes.bool,
};

export default MarkdownToolbar;
