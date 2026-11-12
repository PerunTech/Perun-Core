import React from 'react';

// An option is a string or { id, value, text, title }, shown as its text and saved as its value.
export default class DropDownEditor extends React.Component {
  getInputNode() {
    return this.select
  }

  getValue() {
    return { [this.props.column.key]: this.select.value }
  }

  render() {
    return (
      <select
        ref={(node) => { this.select = node }}
        style={{ width: '100%' }}
        defaultValue={this.props.value}
        onBlur={this.props.onBlur}
      >
        {this.props.options.map((option) => (typeof option === 'string'
          ? <option key={option} value={option}>{option}</option>
          : <option key={option.id} value={option.value} title={option.title}>{option.text || option.value}</option>
        ))}
      </select>
    )
  }
}
