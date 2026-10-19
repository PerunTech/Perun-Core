import React from 'react';
import classNames from 'classnames';
import { useIntl } from 'react-intl';
import { labelBasePath } from '../../../config';

const action = (onClick) => (onClick instanceof Function ? onClick : null)

/* The toolbar above a grid: the row count and whatever else GenericGrid puts in as children, the
custom buttons, and the add row and filter buttons. The grid's body renders it with `onToggleFilter`,
`filtersOpen` and `numberOfRows` added to the props it is given. It used to extend
react-data-grid-addons' Toolbar, from which it took only the last two buttons; they are below, as
Toolbar drew them.

`additionalButton` and `customButton` are what their buttons call. Without a label, either is
labelled as a button that finds a row (with `hasLinkGridInModal`) or adds one. `additionalButtonLabel`
is a label code, `customButtonLabel` the text itself. `buttonsArray` holds more buttons, each as
`{ id, name, action, className }`. */
export default function CustomGridToolbar({
  children, additionalButton, additionalButtonLabel, additionalButtonClassName, customButton, customButtonLabel,
  customButtonClassName, customButtonTitle, hasLinkGridInModal, buttonsArray, onAddRow, numberOfRows,
  addRowButtonText = 'Add Row', enableFilter, filtersOpen, onToggleFilter, filterRowsButtonText = 'Filter Rows'
}) {
  const intl = useIntl()
  const label = (code) => intl.formatMessage({ id: code, defaultMessage: code })
  const buttonLabel = () => label(`${labelBasePath}.main.grids.${hasLinkGridInModal ? 'find_existing' : 'add_simple'}`)

  const addRow = () => {
    if (onAddRow instanceof Function) {
      onAddRow({ newRowIndex: numberOfRows })
    }
  }

  return (
    <div className='react-grid-Toolbar'>
      {children}
      <div className='tools fadeIn'>
        {additionalButton && (
          <button type='button' className={classNames('btn', additionalButtonClassName)} onClick={action(additionalButton)}>
            {additionalButtonLabel ? label(additionalButtonLabel) : buttonLabel()}
          </button>
        )}
        {customButton && (
          <button
            type='button'
            className={classNames('btn', customButtonClassName)}
            title={customButtonTitle}
            onClick={action(customButton)}
          >
            {customButtonLabel || buttonLabel()}
          </button>
        )}
        {buttonsArray && buttonsArray.map((button) => (
          <button
            type='button'
            key={button.id}
            id={button.id}
            className={classNames('btn', button.className)}
            onClick={action(button.action)}
          >
            {button.name}
          </button>
        ))}
        {onAddRow && <button type='button' className='btn' onClick={addRow}>{addRowButtonText}</button>}
        {/* `filtersOpen` tells whether the filter row is open. */}
        {enableFilter && (
          <button
            type='button'
            className='btn'
            data-action='toggle-filters'
            aria-pressed={filtersOpen}
            onClick={onToggleFilter}
          >
            {filterRowsButtonText}
          </button>
        )}
      </div>
    </div>
  )
}
