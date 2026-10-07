import React from 'react';

/* Shows a code list cell as the text of its option, for columns whose grid metadata sets
`formatterType: 'DropDownFormatter'`. The option is the one that is the value itself or whose
`value` is, and a value with no option is shown as it is. As react-data-grid-addons' formatter of
the same name drew it, which codeListValues.js reads options to agree with, except that an empty
cell is drawn empty rather than throwing. */
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
