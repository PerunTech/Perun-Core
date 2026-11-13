import React from 'react'
import { useIntl } from 'react-intl'
import classnames from 'classnames'

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
  disabled,
  maxlength,
  style
}) => {
  const intl = useIntl()
  let message
  if (error !== undefined) {
    className += ' input_error'
    message = intl.formatMessage({ id: error.toString(), defaultMessage: error.toString() })
  }

  return (
    <div className={classnames('form-group ', { 'has-error': error })}>
      <input
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? `${id}-error` : undefined}
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
      {message && <div id={`${id}-error`} className='input-error-message'>{message}</div>}
    </div>)
}

export default InputElement
