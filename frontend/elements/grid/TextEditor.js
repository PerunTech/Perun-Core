import React from 'react';

/* Edits a cell as plain text, for an editable column that names no editor of its own, as
react-data-grid's SimpleTextEditor did: a text box holding the value, saved as typed. The TanStack
body draws it; react-data-grid draws its own.

CellEditor reads it through `getInputNode`, which it focuses and gives the `editor-main` class, and
`getValue`, which it saves. */
export default class TextEditor extends React.Component {
  getInputNode() {
    return this.input
  }

  getValue() {
    return { [this.props.column.key]: this.input.value }
  }

  render() {
    return (
      <input
        ref={(node) => { this.input = node }}
        type='text'
        className='form-control'
        defaultValue={this.props.value}
        onBlur={this.props.onBlur}
      />
    )
  }
}
