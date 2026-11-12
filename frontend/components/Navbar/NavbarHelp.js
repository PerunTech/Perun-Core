import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { Icon } from '../../elements'
import { PDF_KIND } from '../../elements/guides/helpNames'
import { createBlobCache } from '../../elements/guides/helpApi'
import { guideTitle, moduleIdFromPath } from '../../elements/guides/routeGuides'
import { useDrawerWidth } from './useDrawerWidth'
import { useDrawerExports } from './useDrawerExports'
import { useGuideDoc } from './useGuideDoc'
import { useGuideIndex } from './useGuideIndex'
import { useGuideToc } from './useGuideToc'
import MarkdownPreview from '../MarkdownEditor/MarkdownPreview'
import Loading from '../Loading/Loading'
import FigureLightbox from './FigureLightbox'
import GuideList from './GuideList'
import HelpPanelHeader from './HelpPanelHeader'

// The button exists only when the route has a guide, so an empty panel is never reachable.
const NavbarHelp = () => {
  const intl = useIntl()
  const svSession = useSelector(state => state.security.svSession)
  const locale = useSelector(state => state.intl.locale)
  const { pathname } = useLocation()

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [zoom, setZoom] = useState(null)
  // Below the navbar, so the Help button can close it; the navbar's height comes from the deployment's
  // sheet, so it is measured.
  const [top, setTop] = useState(0)

  const cache = useRef(createBlobCache())
  // Read by the key handler, which must not re-subscribe on every zoom change.
  const zoomRef = useRef(null)
  const drawerRef = useRef(null)
  const bodyRef = useRef(null)
  // Keyed by filename, so it survives a re-save.
  const scrollMemory = useRef({})
  // Whatever had focus when the drawer opened, so closing it puts the reader back.
  const restoreFocusRef = useRef(null)

  const fmt = useCallback(
    (id) => intl.formatMessage({ id, defaultMessage: id }),
    [intl]
  )

  const { guides, indexFailed } = useGuideIndex(svSession, pathname, locale)
  const { doc, resolveImage } = useGuideDoc(svSession, active, cache)
  const { width, startResize, resetWidth, resized } = useDrawerWidth(drawerRef, open)
  const { toc, showToc, setShowToc, jumpTo, dismissToc } = useGuideToc(bodyRef, active, doc)

  useEffect(() => () => cache.current.revokeAll(), [])

  // A route change can leave the panel open on a guide that no longer answers here.
  useEffect(() => {
    const stillHere = (guide, current) =>
      guide.fileName === current.fileName && guide.anchorId === current.anchorId
    setActive(current => {
      if (!current) return null
      const match = guides.find(guide => stillHere(guide, current))
      if (!match) return null
      // A new object id means the guide was saved again, which pulls the edit into the open panel.
      return match.objectId === current.objectId ? current : match
    })
  }, [guides])

  // No outside-click dismissal: the reader clicks the very fields a guide explains. Escape unwinds the
  // zoom before the drawer.
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (zoomRef.current) setZoom(null)
      else if (!dismissToc()) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, dismissToc])

  useEffect(() => {
    if (!open) return undefined
    const measure = () => {
      const navbar = document.querySelector('.perun-navbar')
      setTop(navbar ? Math.max(navbar.getBoundingClientRect().bottom, 0) : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => { if (!open) setZoom(null) }, [open])

  // Not modal, so focus is moved in rather than trapped, and given back on close.
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement
      drawerRef.current?.focus({ preventScroll: true })
      return
    }
    const previous = restoreFocusRef.current
    restoreFocusRef.current = null
    if (previous?.isConnected) previous.focus({ preventScroll: true })
  }, [open])

  // The reader leaves to try a step and comes back, so the drawer returns to where it was.
  useEffect(() => {
    if (!active || doc.loading || doc.failed || !bodyRef.current) return
    bodyRef.current.scrollTop = scrollMemory.current[active.fileName] ?? 0
  }, [active, doc.loading, doc.failed, doc.body])

  const handleBodyScroll = useCallback((event) => {
    if (active) scrollMemory.current[active.fileName] = event.currentTarget.scrollTop
  }, [active])

  const { exporting, exportActive, exportRecord, savePdf, openWindow } = useDrawerExports({
    svSession, active, doc, resolveImage, cache, fmt,
  })

  // Always paired with !doc.loading: active flips a render before its fetch starts.
  const isPdf = active?.kind === PDF_KIND

  // Delegated, since the body is replaced on every render.
  const handleBodyClick = useCallback((event) => {
    setShowToc(false)
    const image = event.target?.closest?.('img[src]')
    if (image) setZoom({ src: image.getAttribute('src'), alt: image.getAttribute('alt') ?? '' })
  }, [setShowToc])

  // A guide whose route names no module (/main) answers everywhere, so it is listed apart.
  const [screenGuides, generalGuides] = useMemo(() => {
    const screen = []
    const general = []
    guides.forEach(guide => {
      (moduleIdFromPath(guide.notes?.route) ? screen : general).push(guide)
    })
    return [screen, general]
  }, [guides])

  // Counted over the screen's own guides: a general one answers everywhere and would stop this from
  // ever firing. One guide in total is still opened directly.
  const openDirectly = useMemo(() => {
    if (guides.length === 1) return guides[0]
    if (screenGuides.length === 1) return screenGuides[0]
    return null
  }, [guides, screenGuides])

  const toggle = useCallback(() => {
    setOpen(current => {
      if (!current && openDirectly) setActive(openDirectly)
      return !current
    })
  }, [openDirectly])

  const heading = useMemo(
    () => (active ? guideTitle(active) : fmt('perun.navbar.help')),
    [active, fmt]
  )

  if (!guides.length && !indexFailed && !open) return null

  return (
    <div className='nav-help'>
      {(guides.length > 0 || indexFailed) && (
        <div
          className={`nav-title-help${open ? ' active' : ''}`}
          title={fmt('perun.navbar.help')}
          onClick={toggle}
        >
          <Icon name='IconBook' />
        </div>
      )}

      {/* Always mounted so it can animate; visibility:hidden keeps its buttons out of the tab order. */}
      <div
        className={`help-panel${open ? ' help-panel--open' : ''}`}
        ref={drawerRef}
        style={{ top, width }}
        tabIndex={-1}
        aria-hidden={!open}
      >
          <div
            className='help-panel-resize'
            role='separator'
            aria-orientation='vertical'
            title={fmt('perun.help_panel.resize')}
            onPointerDown={startResize}
            onDoubleClick={resetWidth}
          />
          <HelpPanelHeader
            heading={heading}
            fmt={fmt}
            active={active}
            isPdf={isPdf}
            ready={!doc.loading && !doc.failed}
            showBack={Boolean(active) && guides.length > 1}
            exporting={exporting}
            toc={toc}
            showToc={showToc}
            resized={resized}
            onBack={() => setActive(null)}
            onSavePdf={savePdf}
            onExport={exportActive}
            onOpenWindow={openWindow}
            onToggleToc={() => setShowToc(value => !value)}
            onResetWidth={resetWidth}
            onClose={() => setOpen(false)}
          />

          <div className='help-panel-main'>
            {showToc && (
              <nav className='help-toc' aria-label={fmt('perun.help_panel.contents')}>
                <ul>
                  {toc.map((item, index) => (
                    <li key={`${index}-${item.text}`} className={`help-toc-l${item.level}`}>
                      <button onClick={() => jumpTo(index)}>{item.text}</button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

          <div
            className='help-panel-body'
            ref={bodyRef}
            onClick={handleBodyClick}
            onScroll={handleBodyScroll}
          >
            {!active && (
              <GuideList
                screenGuides={screenGuides}
                generalGuides={generalGuides}
                indexFailed={indexFailed}
                exporting={exporting}
                fmt={fmt}
                onOpen={setActive}
                onExport={exportRecord}
              />
            )}
            {active && doc.loading && <p className='help-panel-note'>{fmt('perun.help_panel.loading')}</p>}
            {active && doc.failed && <p className='help-panel-note'>{fmt('perun.help_panel.failed')}</p>}
            {isPdf && !doc.loading && !doc.failed && (
              <div className='help-panel-manual'>
                <span className='help-panel-manual-icon'>
                  <Icon name='IconFileTypePdf' size={34} stroke={1.4} />
                </span>
                <p className='help-panel-note'>{fmt('perun.help_panel.manual_note')}</p>
                <div className='help-panel-manual-actions'>
                  <button className='md-btn md-btn--primary' onClick={() => window.open(doc.pdfUrl, '_blank', 'noopener')}>
                    <Icon name='IconExternalLink' size={15} stroke={1.7} />
                    {fmt('perun.help_panel.open_manual')}
                  </button>
                  <button className='md-btn md-btn--ghost' onClick={savePdf}>
                    <Icon name='IconDownload' size={15} stroke={1.7} />
                    {fmt('perun.help_panel.download_manual')}
                  </button>
                </div>
              </div>
            )}
            {active && !isPdf && !doc.loading && !doc.failed && (
              <MarkdownPreview markdown={doc.body} resolveImage={resolveImage} className='help-panel-md' />
            )}
          </div>
          </div>
          {exporting && <Loading />}
      </div>

      {zoom && (
        <FigureLightbox src={zoom.src} alt={zoom.alt} fmt={fmt} onClose={() => setZoom(null)} />
      )}
    </div>
  )
}

export default NavbarHelp
