import React from 'react';
import { useIntl } from 'react-intl';
import classnames from 'classnames';
import { Tooltip } from 'react-tooltip';

export const Button = ({
  id,
  name,
  type,
  label,
  className,
  onClick,
  error,
  dataTip,
  disabled
}) => {
  const intl = useIntl()
  dataTip = ''
  if (error !== undefined) {
    className += ' input_error'
    dataTip = error.toString()
  }

  return (
    <div className={classnames('form-group ', { 'has-error': error })}>
      <button
        data-tooltip-id={`${id}-tooltip`}
        data-tooltip-content={dataTip !== '' ? intl.formatMessage({ id: [dataTip], defaultMessage: [dataTip] }) : ''}
        id={id}
        key={id}
        name={name}
        type={type}
        className={`btn ${className}`}
        onClick={onClick}
        disabled={disabled}
      >{label}
      </button>
      <Tooltip event='click focus' globalEventOff='keypress' id={`${id}-tooltip`} />
    </div>
  )
}
