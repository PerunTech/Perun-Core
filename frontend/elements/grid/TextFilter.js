import React, { useState } from 'react';

/* The filter row's cell for a column without a code list: a text box whose rows are the ones
containing its text, in any case (gridRows.js does the matching). It reports `{ filterTerm, column }`
on every change, an empty text included, as react-data-grid's own header input did, and keeps its
text for as long as the filter row is open. */
export default function TextFilter({ column, onChange }) {
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
      placeholder='Search'
      aria-label={column.name}
      value={filterTerm}
      onChange={handleChange}
    />
  )
}
