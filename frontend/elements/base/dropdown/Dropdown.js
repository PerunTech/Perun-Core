import React from 'react';
import { useIntl } from 'react-intl';
import classnames from 'classnames';
import { Tooltip } from 'react-tooltip';

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
  dataTip,
  disabled,
  maxlength,
  style,
  options,
  labelText,
  required
}) => {
  const intl = useIntl()
  dataTip = ''
  if (error !== undefined) {
    className += ' input_error'
    dataTip = error.toString()
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
        required={required}
        maxLength={maxlength}
      >
        {htmlOptions}
      </select>
      <Tooltip event='click focus' globalEventOff='keypress' id={`${id}-tooltip`} />
    </div>
  )
}
