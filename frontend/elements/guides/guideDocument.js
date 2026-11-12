import { figureNames } from './figureRefs'
import { parseFrontMatter } from './frontMatter'
import { fetchHelpText } from './helpApi'
import { figureResolver, loadGuideFigures } from './routeGuides'

// Front matter comes off first (marked would draw it as a rule), and figures come from the body's own
// references, so a file it doesn't name is never fetched. `raw` keeps the front matter for archives.
export const loadGuideDocument = async (svSession, record, cache, { stopIf } = {}) => {
  const raw = await fetchHelpText(svSession, record)
  const { body } = parseFrontMatter(raw)

  const images = stopIf?.() ? {} : await loadGuideFigures(svSession, record, figureNames(body), cache)
  return { raw, body, images, resolveUrl: figureResolver(images) }
}
