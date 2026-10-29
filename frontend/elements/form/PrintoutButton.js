import React from 'react'
import { Icon } from '..'

/**
 * RJSF widget that opens the field value (a print route) in a new tab.
 * Stays clickable even when the form/section is ui:readonly or disabled.
 * The button text is the field's schema title.
 */
const PrintoutButton = ({ id, value, label }) => {
  if (!value) return null

  const print = () => {
    let url = window.server + value
    window.open(url, '_blank')
  }

  return (
    <div id={id + 'PrintoutButton'} className='printout-btn-holder'>
      <button type='button' onClick={print} className='btn-success btn_save_form printout-btn' style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
        <Icon name='IconPrinter' size={18} />
        {label}
      </button>
    </div>
  )
}

export default PrintoutButton
