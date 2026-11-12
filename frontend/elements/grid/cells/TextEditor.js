import React from 'react';

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
