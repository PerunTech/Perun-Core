import React from 'react';
import { useIntl } from 'react-intl';
import classnames from 'classnames';

const generateHtmlOptions = (options) => {
  const htmlOptions = options.map((element) => (<option
    id={element.id}
    key={element.id}
    name={element.name}
    value={element.value}
    selected={element.selected}
    disabled={element.disabled}
    hidden={element.hidden}
  >
    {element.text}
  </option>))
  return htmlOptions
}

export const Dropdown = ({
  id,
  name,
  value,
  placeholder,
  className,
  containerClassName,
  error,
  type,
  onChange,
  onBlur,
  onKeyDown,
  onKeyUp,
  disabled,
  maxlength,
  style,
  options,
  labelText,
  required
}) => {
  const intl = useIntl()
  let message
  if (error !== undefined) {
    className += ' input_error'
    message = intl.formatMessage({ id: error.toString(), defaultMessage: error.toString() })
  }
  let htmlOptions
  if (options) {
    htmlOptions = generateHtmlOptions(options)
  }
  return (
    <div className={classnames(`form-group custom-dropdown-container ${containerClassName}`, { 'has-error': error })} style={style} >
      {labelText && (
        <label className='control-label' htmlFor={id}>
          {labelText}
          {required && <span className='required'>*</span>}
        </label>
      )}
      <select
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
        required={required}
        maxLength={maxlength}
      >
        {htmlOptions}
      </select>
      {message && <div id={`${id}-error`} className='input-error-message'>{message}</div>}
    </div>
  )
}
