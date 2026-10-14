import React from 'react'
import { useIntl } from 'react-intl'
import classnames from 'classnames'
import { Tooltip } from 'react-tooltip'

const InputElement = ({
  id,
  name,
  value,
  placeholder,
  className,
  error,
  type,
  onChange,
  onBlur,
  onKeyDown,
  onKeyUp,
  dataTip,
  disabled,
  maxlength,
  style
}) => {
  const intl = useIntl()
  dataTip = ''
  if (error !== undefined) {
    // placeholder = error;
    className += ' input_error'
    dataTip = error.toString()
  }

  return (
    <div className={classnames('form-group ', { 'has-error': error })}>
      <input
        data-tooltip-id={`${id}-tooltip`}
        data-tooltip-content={dataTip !== '' ? intl.formatMessage({ id: [dataTip], defaultMessage: [dataTip] }) : ''}
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        className={`form-control ${className}`}
        type={type}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        disabled={disabled}
        maxLength={maxlength}
        style={style}
      />
      <Tooltip event='click focus' globalEventOff='keypress' id={`${id}-tooltip`} />
    </div>)
}

export default InputElement
