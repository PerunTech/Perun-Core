import React from 'react';
import Select from 'react-select';

/* The filter row's cell for a code list column: a multi-select of the values the column holds,
offered by the grid's `getValidFilterValues`. GenericGrid gives it to the columns it draws with
DropDownFormatter. As react-data-grid-addons' filter of the same name drew it, on the react-select
1.2.1 that perun-core already depends on.

It reports `{ filterTerm, column, rawValue }`, where `filterTerm` is react-select's array of picked
`{ value, label }` options. The addons' filter also sent a matcher of its own as `filterValues`;
GenericGrid replaced it with its own for every column this filter is used on, so it is not sent. */
export default class AutoCompleteFilter extends React.Component {
  constructor(props) {
    super(props)
    this.state = { options: this.getOptions(props), filters: undefined }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({ options: this.getOptions(nextProps) })
  }

  getOptions(props) {
    return props.getValidFilterValues(props.column.key)
      .map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
  }

  handleChange = (value) => {
    this.setState({ filters: value })
    this.props.onChange({ filterTerm: value, column: this.props.column, rawValue: value })
  }

  render() {
    return (
      <Select
        autosize={false}
        name={`filter-${this.props.column.key}`}
        options={this.state.options}
        placeholder='Search'
        onChange={this.handleChange}
        escapeClearsValue
        multi
        value={this.state.filters}
      />
    )
  }
}
