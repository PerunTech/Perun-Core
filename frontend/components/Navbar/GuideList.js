import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../elements'
import { PDF_KIND } from '../../elements/guides/helpNames'
import { guideTitle } from '../../elements/guides/routeGuides'

const GuideList = ({ screenGuides, generalGuides, indexFailed, exporting, fmt, onOpen, onExport }) => {
  const guideRow = (guide) => (
    <li key={guide.objectId}>
      <button className='help-panel-list-open' onClick={() => onOpen(guide)}>
        <Icon name={guide.kind === PDF_KIND ? 'IconFileTypePdf' : 'IconFileText'} size={18} />
        <span>{guideTitle(guide)}</span>
      </button>
      <span className='help-panel-list-actions'>
        <button
          hidden={guide.kind === PDF_KIND}
          onClick={(event) => onExport(event, guide, 'pdf')}
          disabled={exporting}
          title={fmt('perun.help_panel.download_pdf')}
          aria-label={fmt('perun.help_panel.download_pdf')}
        >
          <Icon name='IconFileTypePdf' size={16} stroke={1.6} />
        </button>
        <button
          hidden={guide.kind === PDF_KIND}
          onClick={(event) => onExport(event, guide, 'source')}
          disabled={exporting}
          title={fmt('perun.help_panel.download_source')}
          aria-label={fmt('perun.help_panel.download_source')}
        >
          <Icon name='IconFileZip' size={16} stroke={1.6} />
        </button>
      </span>
    </li>
  )

  if (!screenGuides.length && !generalGuides.length) {
    return (
      <p className='help-panel-note'>
        {fmt(indexFailed ? 'perun.help_panel.index_failed' : 'perun.help_panel.none')}
      </p>
    )
  }

  return (
    <React.Fragment>
      {screenGuides.length > 0 && (
        <React.Fragment>
          {generalGuides.length > 0 && (
            <p className='help-panel-group'>{fmt('perun.help_panel.this_screen')}</p>
          )}
          <ul className='help-panel-list'>{screenGuides.map(guideRow)}</ul>
        </React.Fragment>
      )}
      {generalGuides.length > 0 && (
        <React.Fragment>
          {/* Labelled even as the whole list: it says these answer for the application. */}
          <p className='help-panel-group'>{fmt('perun.help_panel.general_guides')}</p>
          <ul className='help-panel-list'>{generalGuides.map(guideRow)}</ul>
        </React.Fragment>
      )}
    </React.Fragment>
  )
}

GuideList.propTypes = {
  screenGuides: PropTypes.array.isRequired,
  generalGuides: PropTypes.array.isRequired,
  // A lookup that failed rather than a screen nobody has documented; the two read differently.
  indexFailed: PropTypes.bool,
  exporting: PropTypes.bool,
  fmt: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
}

export default GuideList
