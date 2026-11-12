import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { label } from '../logic/labels';

// Reports every change, an empty text included; logic/rows.js does the matching.
export default function TextFilter({ column, onChange }) {
  const intl = useIntl()
  const [filterTerm, setFilterTerm] = useState('')

  const handleChange = (event) => {
    const value = event.target.value
    setFilterTerm(value)
    onChange({ filterTerm: value, column })
  }

  return (
    <input
      type='text'
      className='form-control input-sm'
      placeholder={label(intl, 'main.grids.search')}
      aria-label={column.name}
      value={filterTerm}
      onChange={handleChange}
    />
  )
}
