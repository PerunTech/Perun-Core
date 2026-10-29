import { labelBasePath } from '../../../config';

/* The text of the label `<labelBasePath>.<code>` (perun.main.grids.add for `main.grids.add`), or
that code while the labels have no text for it. */
export const label = (intl, code) => intl.formatMessage({
  id: `${labelBasePath}.${code}`,
  defaultMessage: `${labelBasePath}.${code}`
})
