import { labelBasePath } from '../../../config';

// react-select's English, for the labels nothing has given a text yet.
const TEXTS = {
  placeholder: 'Select...',
  no_results: 'No results found',
  clear_value: 'Clear value',
  clear_all: 'Clear all',
  backspace_to_remove: 'Press backspace to remove {label}'
}

// intl comes from IntlContext: null outside the provider, where the English above is used.
export function text(intl, code, values) {
  const defaultMessage = TEXTS[code]
  if (!intl) {
    return values ? defaultMessage.replace('{label}', values.label) : defaultMessage
  }
  return intl.formatMessage({ id: `${labelBasePath}.main.select.${code}`, defaultMessage }, values)
}
