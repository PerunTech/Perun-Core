import React from 'react';
import classNames from 'classnames';

// For columns with editorType 'AutoCompleteEditor'. Keeps the markup and class names of the addons'
// editor, which the deployments' sheets style. A pick saves its title, else the typed text.

// How long after focus leaves the list closes, so that a click on a result lands first.
const BLUR_DELAY_MS = 100

const matches = (option, searchTerm) =>
  String(option.title).toLowerCase().includes(searchTerm.trim().toLowerCase())

export default class AutoCompleteEditor extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      searchTerm: props.value === undefined || props.value === null ? '' : props.value,
      results: [],
      showResults: false,
      focusedValue: null
    }
  }

  componentDidUpdate() {
    this.scrollToFocused()
  }

  componentWillUnmount() {
    clearTimeout(this.blurTimer)
  }

  getInputNode() {
    return this.input
  }

  getValue() {
    const option = this.picked || (this.hasResults() ? this.state.focusedValue : null)
    return { [this.props.column.key]: option ? option.title : this.state.searchTerm }
  }

  hasResults() {
    return this.state.results.length > 0
  }

  showResults(searchTerm) {
    const options = this.props.options || []
    this.setState({ results: options.filter((option) => matches(option, searchTerm)), showResults: true })
  }

  showAllResults = () => {
    if (!this.state.showResults) {
      this.showResults('')
    }
  }

  // CellEditor asks for the value before this state update applies, so the pick is kept where
  // getValue finds it at once.
  pick(option) {
    this.picked = option
    this.setState({ searchTerm: option.title, showResults: false })
  }

  focusedIndex() {
    const { focusedValue, results } = this.state
    return focusedValue ? results.findIndex((result) => result.id === focusedValue.id) : -1
  }

  onQueryChange = (event) => {
    const searchTerm = event.target.value
    this.setState({ searchTerm, focusedValue: null })
    this.showResults(searchTerm)
  }

  onQueryKeyDown = (event) => {
    const { results, showResults, focusedValue } = this.state
    if (event.key === 'Enter') {
      // Left to reach CellEditor, which saves on Enter.
      event.preventDefault()
      if (focusedValue) {
        this.pick(focusedValue)
      }
    } else if (event.key === 'ArrowUp' && showResults) {
      event.preventDefault()
      this.setState({ focusedValue: results[Math.max(this.focusedIndex() - 1, 0)] })
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (showResults) {
        this.setState({ focusedValue: results[Math.min(this.focusedIndex() + 1, results.length - 1)] })
      } else {
        this.showAllResults()
      }
    }
  }

  // Focus that lands on the wrapper, as it does when a result is clicked, goes back to the field.
  onFocus = () => {
    clearTimeout(this.blurTimer)
    this.input.focus()
  }

  onBlur = () => {
    this.blurTimer = setTimeout(() => this.setState({ showResults: false }), BLUR_DELAY_MS)
  }

  // Scrolling the list moves another result under a resting pointer, which the browser reports as the
  // pointer entering it; that must not take the focus from the arrows.
  scrollToFocused() {
    const node = this.results && this.results.querySelector('.react-autocomplete-Result--active')
    if (!node) {
      return
    }
    const { scrollTop, offsetHeight } = this.results
    const top = node.offsetTop
    const bottom = top + node.offsetHeight
    if (top < scrollTop) {
      this.ignoreMouseEnter = true
      this.results.scrollTop = top
    } else if (bottom - scrollTop > offsetHeight) {
      this.ignoreMouseEnter = true
      this.results.scrollTop = bottom - offsetHeight
    }
  }

  onResultMouseEnter(event, result) {
    if (this.ignoreMouseEnter) {
      this.ignoreMouseEnter = false
      return
    }
    // Only a result the pointer can actually see, since the list's shadow also takes pointer events.
    const { scrollTop, offsetHeight } = this.results
    const top = event.currentTarget.offsetTop
    const bottom = top + event.currentTarget.offsetHeight
    if (bottom > scrollTop && top < scrollTop + offsetHeight) {
      this.setState({ focusedValue: result })
    }
  }

  render() {
    const { results, showResults, searchTerm, focusedValue } = this.state
    return (
      <div
        tabIndex='1'
        className={classNames('react-autocomplete-Autocomplete', { 'react-autocomplete-Autocomplete--resultsShown': showResults })}
        style={{ position: 'relative', outline: 'none' }}
        onFocus={this.onFocus}
        onBlur={this.onBlur}
      >
        <input
          ref={(node) => { this.input = node }}
          className='react-autocomplete-Autocomplete__search'
          style={{ width: '100%' }}
          value={searchTerm}
          onClick={this.showAllResults}
          onChange={this.onQueryChange}
          onFocus={this.showAllResults}
          onKeyDown={this.onQueryKeyDown}
        />
        <ul
          ref={(node) => { this.results = node }}
          className='react-autocomplete-Autocomplete__results react-autocomplete-Results'
          style={{ display: showResults ? 'block' : 'none', position: 'absolute', listStyleType: 'none' }}
        >
          {results.map((result) => (
            <li
              key={result.id}
              className={classNames('react-autocomplete-Result', {
                'react-autocomplete-Result--active': Boolean(focusedValue) && focusedValue.id === result.id
              })}
              style={{ listStyleType: 'none' }}
              onClick={() => {
                this.pick(result)
                this.props.onCommit()
              }}
              onMouseEnter={(event) => this.onResultMouseEnter(event, result)}
            >
              <a>{result.title}</a>
            </li>
          ))}
        </ul>
      </div>
    )
  }
}
