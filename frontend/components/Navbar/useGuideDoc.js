import { useEffect, useMemo, useState } from 'react'
import { PDF_KIND } from '../../elements/guides/helpNames'
import { figureResolver } from '../../elements/guides/routeGuides'
import { loadGuideDocument } from '../../elements/guides/guideDocument'

const EMPTY = { raw: '', body: '', images: {}, pdfUrl: null, loading: false, failed: false }

/**
 * The guide the drawer is showing, and the figure resolver that goes with it.
 *
 * Only the figures the document actually references are fetched, and only once the reader has
 * opened that document, so an illustrated manual costs nothing until it is read.
 *
 * @param {object} active the guide record on screen, or null for the list
 * @param {object} cache  a blob cache from createBlobCache
 * @returns {{doc: object, resolveImage: Function}}
 *   `doc.loading` matters to every caller: `active` flips a render before the fetch for it starts,
 *   so a surface reading `doc` without it would draw the new guide's chrome over the old one's body.
 */
export const useGuideDoc = (svSession, active, cache) => {
  const [doc, setDoc] = useState(EMPTY)

  useEffect(() => {
    // No session is a logout in progress; fetching anyway 401s into the interceptor's alert.
    if (!active || !svSession) return undefined
    let cancelled = false

    const load = async () => {
      setDoc({ ...EMPTY, loading: true })
      try {
        // An uploaded manual is handed over rather than rendered, so nothing is parsed and no
        // figures are looked for: the file carries its own. The blob is fetched here anyway,
        // because downloadFile answers with content-disposition: attachment, so pointing a tab at
        // the endpoint downloads the file instead of showing it. A blob URL is what lets the
        // browser's own viewer open it, and the cache means opening it twice costs one fetch.
        if (active.kind === PDF_KIND) {
          const pdfUrl = await cache.current.get(svSession, active)
          if (!cancelled) setDoc({ ...EMPTY, pdfUrl })
          return
        }

        const { raw, body, images } = await loadGuideDocument(svSession, active, cache.current,
          { stopIf: () => cancelled })
        if (!cancelled) setDoc({ ...EMPTY, raw, body, images })
      } catch (err) {
        console.error(err)
        if (!cancelled) setDoc({ ...EMPTY, failed: true })
      }
    }

    load()
    return () => { cancelled = true }
  }, [active, svSession, cache])

  const resolveImage = useMemo(() => figureResolver(doc.images), [doc.images])

  return { doc, resolveImage }
}
