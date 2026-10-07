import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../../elements'
import { PDF_KIND, docStem, kindExtension } from '../../../elements/guides/helpNames'

/**
 * The stored guides, one row each.
 *
 * Presentational: every action is handed in, so this file holds what a row looks like and nothing
 * about what happens when one is clicked. The row itself opens the editor, which is why each
 * action button stops the click from reaching it.
 */
const GuidesTable = ({ docs, moduleLabel, fmt, exporting, saving, onOpen, onExport, onReplace, onDelete }) => (
  <table className='user-guides-table'>
    <thead>
      <tr>
        <th>{fmt('perun.admin_console.user_guides_module')}</th>
        <th>{fmt('perun.help_editor.title')}</th>
        <th>{fmt('perun.help_editor.route')}</th>
        <th>{fmt('perun.help_editor.locale')}</th>
        <th>{fmt('perun.help_editor.order')}</th>
        <th>{fmt('perun.admin_console.user_guides_file')}</th>
        <th aria-label={fmt('perun.admin_console.user_guides_delete')} />
      </tr>
    </thead>
    <tbody>
      {docs.map(doc => (
        <tr key={`${doc.module}/${doc.objectId}`} onClick={() => onOpen(doc)}>
          <td>{moduleLabel(doc.notes?.route)}</td>
          <td>{doc.notes?.title || doc.slug}</td>
          <td><code>{doc.notes?.route || '--'}</code></td>
          <td>{doc.locale}</td>
          <td>{doc.notes?.order ?? ''}</td>
          <td>
            <code>{`${docStem(doc.fileName)}.${kindExtension(doc.kind)}`}</code>
          </td>
          <td className='user-guides-row-actions'>
            <button
              type='button'
              className='user-guides-action'
              hidden={doc.kind === PDF_KIND}
              disabled={exporting}
              title={fmt('perun.help_panel.download_pdf')}
              aria-label={fmt('perun.help_panel.download_pdf')}
              onClick={event => onExport(event, doc, 'pdf')}
            >
              <Icon name='IconFileTypePdf' size={17} stroke={1.6} />
            </button>
            <button
              type='button'
              className='user-guides-action'
              hidden={doc.kind === PDF_KIND}
              disabled={exporting}
              title={fmt('perun.help_panel.download_source')}
              aria-label={fmt('perun.help_panel.download_source')}
              onClick={event => onExport(event, doc, 'source')}
            >
              <Icon name='IconFileZip' size={17} stroke={1.6} />
            </button>
            <button
              type='button'
              className='user-guides-action'
              hidden={doc.kind !== PDF_KIND}
              disabled={saving}
              title={fmt('perun.admin_console.user_guides_replace')}
              aria-label={fmt('perun.admin_console.user_guides_replace')}
              onClick={event => onReplace(event, doc)}
            >
              <Icon name='IconUpload' size={17} stroke={1.6} />
            </button>
            <button
              type='button'
              className='user-guides-delete'
              title={fmt('perun.admin_console.user_guides_delete')}
              disabled={saving}
              onClick={event => onDelete(event, doc)}
            >
              <Icon name='IconTrash' size={17} stroke={1.6} />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)

GuidesTable.propTypes = {
  docs: PropTypes.array.isRequired,
  moduleLabel: PropTypes.func.isRequired,
  fmt: PropTypes.func.isRequired,
  exporting: PropTypes.bool,
  saving: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  onReplace: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
}

export default GuidesTable
