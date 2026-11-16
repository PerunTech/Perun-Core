import { guideFormat } from './guideFormat'
import { fetchHelpText } from './helpApi'
import { figureResolver, loadGuideFigures } from './routeGuides'

// The metadata comes off first (marked would draw front matter as a rule), and figures come from the
// body's own references, so a file it doesn't name is never fetched. `raw` keeps the metadata for archives.
export const loadGuideDocument = async (svSession, record, cache, { stopIf } = {}) => {
  const raw = await fetchHelpText(svSession, record)
  const format = guideFormat(record.kind)
  const { body } = format.parse(raw)

  const images = stopIf?.() ? {} : await loadGuideFigures(svSession, record, format.figureNames(body), cache)
  return { raw, body, images, resolveUrl: figureResolver(images) }
}
