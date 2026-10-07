import { figureNames } from './figureRefs'
import { parseFrontMatter } from './frontMatter'
import { fetchHelpText } from './helpApi'
import { figureResolver, loadGuideFigures } from './routeGuides'

/**
 * Reads one stored guide, and everything a surface needs to render or export it.
 *
 * The four steps have an order that is not self-evident, and it was written out at three call sites
 * before this. The front matter comes off first: the reader has already used it to find the
 * document, and marked would otherwise draw the fence as a rule followed by its raw keys. The
 * figures are then taken from the body's own references rather than from any listing, so a stored
 * file the document does not name is never fetched, and a reference with nothing behind it is
 * visible as a missing figure rather than silently dropped.
 *
 * The record carries its own anchor, so both surfaces tag their records with the plugin row they
 * came off and neither has to map a module back to an object id here.
 *
 * @param {object} record     a guide record carrying anchorId, locale and slug
 * @param {object} cache      a blob cache from createBlobCache
 * @param {Function} [stopIf] consulted once the text has arrived. Answer true and the figures are
 *   left unfetched, for a caller whose effect was torn down while the text was in flight.
 * @returns {Promise<{raw: string, body: string, images: object, resolveUrl: Function}>}
 *   `raw` is the document as stored, front matter included, which is what an archive carries;
 *   `body` is what is rendered and laid out.
 */
export const loadGuideDocument = async (svSession, record, cache, { stopIf } = {}) => {
  const raw = await fetchHelpText(svSession, record)
  const { body } = parseFrontMatter(raw)

  const images = stopIf?.() ? {} : await loadGuideFigures(svSession, record, figureNames(body), cache)
  return { raw, body, images, resolveUrl: figureResolver(images) }
}
