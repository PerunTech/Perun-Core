import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../elements'

/**
 * The drawer's title bar.
 *
 * Every control here is conditional on what is open, which is the whole of its logic: the back
 * arrow only when there is a list to go back to, the export buttons only on a rendered guide, the
 * download only on a handed-over manual, and the contents only when the guide has enough headings
 * to be worth jumping around. `ready` is the common half of those conditions, a guide on screen
 * that finished loading, since a control acting on a document that is not there yet does nothing.
 */
const HelpPanelHeader = ({
  heading, fmt, active, isPdf, ready, showBack, exporting, toc, showToc,
  onBack, onSavePdf, onExport, onOpenWindow, onToggleToc, onResetWidth, onClose, resized,
}) => (
  <div className='help-panel-header'>
    {showBack && (
      <button className='help-panel-back' onClick={onBack} title={fmt('perun.help_panel.back')}>
        <Icon name='IconChevronLeft' size={20} />
      </button>
    )}
    <p className='help-panel-title'>{heading}</p>

    {isPdf && ready && (
      <button
        className='help-panel-window-btn'
        onClick={onSavePdf}
        title={fmt('perun.help_panel.download_manual')}
        aria-label={fmt('perun.help_panel.download_manual')}
      >
        <Icon name='IconDownload' size={17} stroke={1.6} />
      </button>
    )}

    {active && !isPdf && ready && (
      <React.Fragment>
        <button
          className='help-panel-window-btn'
          onClick={() => onExport('pdf')}
          disabled={exporting}
          title={fmt('perun.help_panel.download_pdf')}
          aria-label={fmt('perun.help_panel.download_pdf')}
        >
          <Icon name='IconFileTypePdf' size={17} stroke={1.6} />
        </button>
        <button
          className='help-panel-window-btn'
          onClick={() => onExport('source')}
          disabled={exporting}
          title={fmt('perun.help_panel.download_source')}
          aria-label={fmt('perun.help_panel.download_source')}
        >
          <Icon name='IconFileZip' size={17} stroke={1.6} />
        </button>
        <button
          className='help-panel-window-btn'
          onClick={onOpenWindow}
          title={fmt('perun.help_panel.open_window')}
          aria-label={fmt('perun.help_panel.open_window')}
        >
          <Icon name='IconExternalLink' size={17} stroke={1.6} />
        </button>
      </React.Fragment>
    )}

    {active && toc.length > 1 && (
      <button
        className={`help-panel-toc-btn${showToc ? ' is-open' : ''}`}
        onClick={onToggleToc}
        title={fmt('perun.help_panel.contents')}
        aria-label={fmt('perun.help_panel.contents')}
        aria-expanded={showToc}
      >
        <Icon name='IconList' size={18} stroke={1.6} />
      </button>
    )}

    {resized && (
      <button
        className='help-panel-reset'
        onClick={onResetWidth}
        title={fmt('perun.help_panel.reset_width')}
        aria-label={fmt('perun.help_panel.reset_width')}
      >
        <Icon name='IconRestore' size={17} stroke={1.6} />
      </button>
    )}

    <button className='help-panel-close' onClick={onClose} title={fmt('perun.help_panel.close')}>
      <Icon name='IconX' size={20} />
    </button>
  </div>
)

HelpPanelHeader.propTypes = {
  heading: PropTypes.string.isRequired,
  fmt: PropTypes.func.isRequired,
  // The guide on screen, or null for the list.
  active: PropTypes.object,
  isPdf: PropTypes.bool,
  // A guide that is on screen and finished loading, which is what every control here acts on.
  ready: PropTypes.bool,
  showBack: PropTypes.bool,
  exporting: PropTypes.bool,
  toc: PropTypes.array.isRequired,
  showToc: PropTypes.bool,
  resized: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
  onSavePdf: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  onOpenWindow: PropTypes.func.isRequired,
  onToggleToc: PropTypes.func.isRequired,
  onResetWidth: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default HelpPanelHeader
