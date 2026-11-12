import React from 'react';

// A value with no option is shown as it is. logic/codeList.js reads options the same way.
export default class DropDownFormatter extends React.Component {
  shouldComponentUpdate(nextProps) {
    return nextProps.value !== this.props.value
  }

  render() {
    const { value, options } = this.props
    const option = options.find((candidate) => candidate === value || candidate.value === value) || value
    if (option === null || option === undefined) {
      return <div />
    }
    const title = option.title || option.value || option
    const text = option.text || option.value || option
    return <div title={title}>{text}</div>
  }
}
