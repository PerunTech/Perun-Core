import React, { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import Select from '../../base/select/Select';
import { label } from '../logic/labels';

// filterTerm is the array of picked { value, label } options; GenericGrid adds the matcher itself.
export default function AutoCompleteFilter({ column, onChange, getValidFilterValues }) {
  const intl = useIntl()
  const [filters, setFilters] = useState(undefined)
  const options = useMemo(() => getValidFilterValues(column.key)
    .map((option) => (typeof option === 'string' ? { value: option, label: option } : option)), [getValidFilterValues, column.key])

  const handleChange = (value) => {
    setFilters(value)
    onChange({ filterTerm: value, column, rawValue: value })
  }

  return (
    <Select
      autosize={false}
      name={`filter-${column.key}`}
      options={options}
      placeholder={label(intl, 'main.grids.search')}
      aria-label={column.name}
      onChange={handleChange}
      escapeClearsValue
      multi
      value={filters}
    />
  )
}
