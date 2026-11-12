import { useEffect, useMemo, useState } from 'react'
import { PDF_KIND } from '../../elements/guides/helpNames'
import { figureResolver } from '../../elements/guides/routeGuides'
import { loadGuideDocument } from '../../elements/guides/guideDocument'
import { loadMarkdown } from '../../elements/guides/renderMarkdown'

const EMPTY = { raw: '', body: '', images: {}, pdfUrl: null, loading: false, failed: false }

// Figures are fetched only for a document once it is opened. Callers must check doc.loading: active
// flips a render before its fetch starts.
export const useGuideDoc = (svSession, active, cache) => {
  const [doc, setDoc] = useState(EMPTY)

  useEffect(() => {
    // No session is a logout in progress; fetching anyway 401s into the interceptor's alert.
    if (!active || !svSession) return undefined
    let cancelled = false

    const load = async () => {
      setDoc({ ...EMPTY, loading: true })
      try {
        // A manual is fetched as a blob because downloadFile answers content-disposition: attachment;
        // a blob URL lets the browser's own viewer open it.
        if (active.kind === PDF_KIND) {
          const pdfUrl = await cache.current.get(svSession, active)
          if (!cancelled) setDoc({ ...EMPTY, pdfUrl })
          return
        }

        // The renderer comes with the text, since useGuideToc reads the headings in the commit that
        // draws the body.
        const [{ raw, body, images }] = await Promise.all([
          loadGuideDocument(svSession, active, cache.current, { stopIf: () => cancelled }),
          loadMarkdown(),
        ])
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
