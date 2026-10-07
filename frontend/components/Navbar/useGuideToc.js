import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The table of contents for the guide on screen, built from the rendered headings.
 *
 * Read off the DOM rather than parsed out of the Markdown, so it lists exactly what the reader can
 * actually jump to: a heading the renderer dropped is not offered, and a heading it added is.
 *
 * @param {object} bodyRef the scrolling element the guide is rendered into
 * @param {object} active  the guide record on screen, or null for the list
 * @param {object} doc     the loaded document, for its body and its loading/failed flags
 */
export const useGuideToc = (bodyRef, active, doc) => {
  const [toc, setToc] = useState([])
  const [showToc, setShowToc] = useState(false)
  // The heading elements themselves rather than offsets: a figure decoding after the guide renders
  // moves every offset below it, and a live node is always current.
  const headingsRef = useRef([])
  // Read by the drawer's key handler, which must not re-subscribe every time the list opens.
  const openRef = useRef(false)

  useEffect(() => { openRef.current = showToc }, [showToc])

  // MarkdownPreview appends its fragment from its own effect, and child effects run before the
  // parent's, so the headings are already in the DOM by the time this runs.
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !active || doc.loading || doc.failed) {
      headingsRef.current = []
      setToc([])
      return
    }
    const nodes = [...body.querySelectorAll('.help-panel-md h1, .help-panel-md h2, .help-panel-md h3')]
    headingsRef.current = nodes
    setToc(nodes.map(node => ({ text: node.textContent.trim(), level: Number(node.tagName[1]) })))
  }, [bodyRef, active, doc.body, doc.loading, doc.failed])

  useEffect(() => { setShowToc(false) }, [active])

  const jumpTo = useCallback((index) => {
    const body = bodyRef.current
    const node = headingsRef.current[index]
    if (!body || !node) return
    // Same rebasing as the editor's scroll sync: viewport coordinates onto the scrolled content.
    const base = body.getBoundingClientRect().top - body.scrollTop
    body.scrollTop = Math.max(node.getBoundingClientRect().top - base - 10, 0)
    setShowToc(false)
  }, [bodyRef])

  /**
   * Closes the list if it is open, and says whether it was.
   *
   * Escape unwinds one layer at a time, and the handler that decides which layer is registered once
   * for the life of the drawer. Answering from a ref is what lets it stay stable.
   */
  const dismissToc = useCallback(() => {
    if (!openRef.current) return false
    setShowToc(false)
    return true
  }, [])

  return { toc, showToc, setShowToc, jumpTo, dismissToc }
}
