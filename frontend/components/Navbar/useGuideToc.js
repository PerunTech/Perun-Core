import { useCallback, useEffect, useRef, useState } from 'react'

// Read off the DOM, so it lists exactly the headings the renderer drew.
export const useGuideToc = (bodyRef, active, doc) => {
  const [toc, setToc] = useState([])
  const [showToc, setShowToc] = useState(false)
  // Nodes, not offsets: a figure decoding later moves every offset below it.
  const headingsRef = useRef([])
  // Read by the drawer's key handler, which must not re-subscribe every time the list opens.
  const openRef = useRef(false)

  useEffect(() => { openRef.current = showToc }, [showToc])

  // MarkdownPreview appends from its own effect, which runs before this parent's.
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
    // Viewport coordinates onto the scrolled content.
    const base = body.getBoundingClientRect().top - body.scrollTop
    body.scrollTop = Math.max(node.getBoundingClientRect().top - base - 10, 0)
    setShowToc(false)
  }, [bodyRef])

  // From a ref, so the drawer's Escape handler can stay registered once.
  const dismissToc = useCallback(() => {
    if (!openRef.current) return false
    setShowToc(false)
    return true
  }, [])

  return { toc, showToc, setShowToc, jumpTo, dismissToc }
}
