import React from 'react';
import classNames from 'classnames';
import { useIntl } from 'react-intl';
import { label } from '../logic/labels';

const action = (onClick) => (onClick instanceof Function ? onClick : null)

// additionalButtonLabel is a label code; customButtonLabel is the text itself.
const codeText = (intl, code) => intl.formatMessage({ id: code, defaultMessage: code })

const unlabelled = (intl, hasLinkGridInModal) => label(intl, `main.grids.${hasLinkGridInModal ? 'find_existing' : 'add_simple'}`)

export default function CustomGridToolbar({
  children, additionalButton, additionalButtonLabel, additionalButtonClassName, customButton, customButtonLabel,
  customButtonClassName, customButtonTitle, hasLinkGridInModal, buttonsArray, onAddRow, numberOfRows,
  addRowButtonText = 'Add Row', enableFilter, filtersOpen, onToggleFilter, filterRowsButtonText = 'Filter Rows'
}) {
  const intl = useIntl()

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
            {additionalButtonLabel ? codeText(intl, additionalButtonLabel) : unlabelled(intl, hasLinkGridInModal)}
          </button>
        )}
        {customButton && (
          <button
            type='button'
            className={classNames('btn', customButtonClassName)}
            title={customButtonTitle}
            onClick={action(customButton)}
          >
            {customButtonLabel || unlabelled(intl, hasLinkGridInModal)}
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
