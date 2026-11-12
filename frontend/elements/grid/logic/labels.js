import { labelBasePath } from '../../../config';

// The label <labelBasePath>.<code>, or the code while it has no text.
export const label = (intl, code) => intl.formatMessage({
  id: `${labelBasePath}.${code}`,
  defaultMessage: `${labelBasePath}.${code}`
})
