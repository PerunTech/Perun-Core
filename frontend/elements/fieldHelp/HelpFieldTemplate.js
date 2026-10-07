import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { Icon, ReactBootstrap } from '../index'
import HelpContext from './HelpContext'
import { fetchLabelText } from './helpConfig'

const { useState, useRef, useContext } = React
const { Overlay, Popover } = ReactBootstrap

const HelpFieldTemplate = ({
  id,
  label,
  required,
  children,
  errors,
  help,
  description,
  hidden,
  displayLabel,
  uiSchema,
  classNames,
  style,
  disabled,
  readonly,
  schema,
  registry,
  onDropPropertyClick,
  onKeyChange
}, context) => {
  const [showHelp, setShowHelp] = useState(false)
  const [apiText, setApiText] = useState('')
  const [loading, setLoading] = useState(false)
  const btnRef = useRef(null)
  const { sectionId } = useContext(HelpContext)
  const svSession = useSelector(state => state.security.svSession)
  const locale = useSelector(state => state.intl.locale)

  const fieldName = id ? id.replace(/^root_/, '').toLowerCase() : null
  const uiHelpCode = uiSchema?.['ui:helpCode'] || null
  const helpSectionId = registry?.formContext?.helpSectionId
  const helpScope = helpSectionId ? helpSectionId.toLowerCase() : sectionId
  const derivedCode = helpScope && fieldName ? `perun.admin_console.${helpScope}.form.${fieldName}.help` : null
  const isDependencyDropdown = uiSchema?.['ui:widget'] === 'DependencyDropdown'
  const labelCode = isDependencyDropdown ? uiHelpCode : (uiHelpCode || derivedCode)

  if (hidden) {
    return <div style={{ display: 'none' }}>{children}</div>
  }

  const disableHelpButtons = registry?.formContext?.disableHelpButtons

  const shortText = !disableHelpButtons && labelCode ? context.intl.formatMessage({ id: labelCode, defaultMessage: labelCode }) : ''
  const helpText = apiText || shortText || null

  const WrapIfAdditionalTemplate = registry?.templates?.WrapIfAdditionalTemplate
  const isCheckbox = schema?.type === 'boolean'
  const iconSize = registry?.formContext?.fieldHelpIconSize ?? 22

  const handleHelpClick = (e) => {
    e.stopPropagation()
    if (!apiText && labelCode && svSession) {
      setLoading(true)
      fetchLabelText(labelCode, svSession, locale).then(text => {
        setApiText(text)
        setLoading(false)
      })
    }
    setShowHelp(v => !v)
  }

  const helpButton = shortText && (
    <button
      ref={btnRef}
      type='button'
      tabIndex={-1}
      className={`admin-console-field-help-btn${showHelp ? ' admin-console-field-help-btn--active' : ''}`}
      onClick={handleHelpClick}
    >
      <Icon name={showHelp ? 'IconHelpCircleFilled' : 'IconHelpCircle'} size={iconSize} stroke={1.5} />
    </button>
  )

  const helpOverlay = shortText && (
    <Overlay
      target={btnRef.current}
      show={showHelp}
      placement='right'
      rootClose
      onHide={() => setShowHelp(false)}
    >
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
  )

  const labelRow = !isDependencyDropdown && displayLabel && label && (
    <div className='admin-console-field-label-row'>
      <label className='control-label' htmlFor={id}>
        {label}
        {required && <span className='required'>{'*'}</span>}
      </label>
      {helpButton}
      {helpOverlay}
    </div>
  )

  const fieldChildren = isCheckbox && shortText ? (
    <div className='admin-console-checkbox-field-row'>
      {children}
      {helpButton}
      {helpOverlay}
    </div>
  ) : children

  if (WrapIfAdditionalTemplate) {
    return (
      <WrapIfAdditionalTemplate
        classNames={classNames}
        style={style}
        disabled={disabled}
        id={id}
        label={label}
        onDropPropertyClick={onDropPropertyClick}
        onKeyChange={onKeyChange}
        readonly={readonly}
        required={required}
        schema={schema}
        uiSchema={uiSchema}
        registry={registry}
      >
        {labelRow}
        {displayLabel && description}
        {fieldChildren}
        {errors}
        {help}
      </WrapIfAdditionalTemplate>
    )
  }

  return (
    <div className={classNames} style={style}>
      {labelRow}
      {displayLabel && description}
      {fieldChildren}
      {errors}
      {help}
    </div>
  )
}

HelpFieldTemplate.contextTypes = {
  intl: PropTypes.object.isRequired
}

HelpFieldTemplate.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
  required: PropTypes.bool,
  children: PropTypes.node,
  errors: PropTypes.node,
  help: PropTypes.node,
  description: PropTypes.node,
  hidden: PropTypes.bool,
  displayLabel: PropTypes.bool,
  uiSchema: PropTypes.object,
  classNames: PropTypes.string,
  style: PropTypes.object,
  disabled: PropTypes.bool,
  readonly: PropTypes.bool,
  schema: PropTypes.object,
  registry: PropTypes.object,
  onDropPropertyClick: PropTypes.func,
  onKeyChange: PropTypes.func
}

export default HelpFieldTemplate
