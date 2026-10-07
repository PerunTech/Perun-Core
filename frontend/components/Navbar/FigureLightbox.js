import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from '../../elements'

/**
 * One figure, full size.
 *
 * Figures render into a drawer a few hundred pixels wide, which is unreadable for a screenshot.
 * Dismissed by clicking anywhere, the close button included, so there is nothing to aim at.
 */
const FigureLightbox = ({ src, alt, fmt, onClose }) => (
  <div
    className='help-lightbox'
    role='dialog'
    aria-label={alt || fmt('perun.help_panel.figure')}
    onClick={onClose}
  >
    <img src={src} alt={alt} />
    {alt && <p className='help-lightbox-caption'>{alt}</p>}
    <button className='help-lightbox-close' title={fmt('perun.help_panel.close')}>
      <Icon name='IconX' size={22} />
    </button>
  </div>
)

FigureLightbox.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  fmt: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default FigureLightbox
