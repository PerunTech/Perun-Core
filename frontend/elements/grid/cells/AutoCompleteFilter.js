import React, { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import Select from '../../base/select/Select';
import { label } from '../logic/labels';

/* The filter row's cell for a code list column: a multi-select of the values the column holds,
offered by the grid's `getValidFilterValues`. GenericGrid gives it to the columns it draws with
DropDownFormatter. As react-data-grid-addons' filter of the same name drew it, now on perun-core's
own Select.

It reports `{ filterTerm, column, rawValue }`, where `filterTerm` is the array of picked
`{ value, label }` options. The addons' filter also sent a matcher of its own as `filterValues`;
GenericGrid replaced it with its own for every column this filter is used on, so it is not sent. */
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
