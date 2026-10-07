import React from 'react';

/* Edits a cell with a `<select>` of the column's `editorOptions`, for columns whose grid metadata
sets `editorType: 'DropDownEditor'`. An option is either a string, or `{ id, value, text, title }`,
shown as its text (or its value) and saved as its value. As react-data-grid-addons' editor of the
same name drew it.

react-data-grid's editor container reads the editor through `getInputNode`, which it focuses and
gives the `editor-main` class, and `getValue`, which it saves. */
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
