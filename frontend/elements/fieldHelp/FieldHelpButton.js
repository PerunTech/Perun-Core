import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { Icon, ReactBootstrap } from '../index'
import { fetchLabelText } from './helpConfig'

const { useState, useRef } = React
const { Overlay, Popover } = ReactBootstrap

const FieldHelpButton = ({ labelCode, iconSize = 22 }, context) => {
  const [showHelp, setShowHelp] = useState(false)
  const [apiText, setApiText] = useState('')
  const [loading, setLoading] = useState(false)
  const btnRef = useRef(null)
  const svSession = useSelector(state => state.security.svSession)
  const locale = useSelector(state => state.intl.locale)

  if (!labelCode) return null

  const shortText = context.intl.formatMessage({ id: labelCode, defaultMessage: labelCode })
  if (!shortText) return null

  const helpText = apiText || shortText

  const handleHelpClick = (e) => {
    e.stopPropagation()
    if (!apiText && svSession) {
      setLoading(true)
      fetchLabelText(labelCode, svSession, locale).then(text => {
        setApiText(text)
        setLoading(false)
      })
    }
    setShowHelp(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        type='button'
        tabIndex={-1}
        className={`admin-console-field-help-btn${showHelp ? ' admin-console-field-help-btn--active' : ''}`}
        onClick={handleHelpClick}
      >
        <Icon name={showHelp ? 'IconHelpCircleFilled' : 'IconHelpCircle'} size={iconSize} stroke={1.5} />
      </button>
      <Overlay target={btnRef.current} show={showHelp} placement='right' rootClose onHide={() => setShowHelp(false)}>
        {overlayProps => (
          <Popover {...overlayProps} className='admin-console-field-help-popover'>
            <Popover.Body>
              {loading
                ? <span className='admin-console-field-help-popover-loading'><Icon name='IconLoader2' size={16} stroke={1.5} /></span>
                : helpText
              }
            </Popover.Body>
          </Popover>
        )}
      </Overlay>
    </>
  )
}

FieldHelpButton.contextTypes = {
  intl: PropTypes.object.isRequired
}

export default FieldHelpButton
