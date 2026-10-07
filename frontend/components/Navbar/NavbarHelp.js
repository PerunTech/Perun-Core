import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
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

/**
 * Route-aware user guides.
 *
 * The button only exists when the current route actually has a guide, so an empty panel is never
 * reachable and the navbar stays quiet on routes nobody has documented yet.
 */
const NavbarHelp = (props, context) => {
  const svSession = useSelector(state => state.security.svSession)
  const locale = useSelector(state => state.intl.locale)
  const { pathname } = useLocation()

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [zoom, setZoom] = useState(null)
  // The drawer hangs below the navbar rather than over it, so the Help button stays reachable to
  // toggle it shut. The navbar's own height comes from the deployment's stylesheet, so it is
  // measured rather than assumed.
  const [top, setTop] = useState(0)

  const cache = useRef(createBlobCache())
  // Read by the key handler, which must not re-subscribe on every zoom change.
  const zoomRef = useRef(null)
  const drawerRef = useRef(null)
  const bodyRef = useRef(null)
  // Where the reader had got to in each guide, keyed by filename so it survives a re-save.
  const scrollMemory = useRef({})
  // Whatever had focus when the drawer opened, so closing it puts the reader back.
  const restoreFocusRef = useRef(null)

  const fmt = useCallback(
    (id) => context.intl.formatMessage({ id, defaultMessage: id }),
    [context.intl]
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
      // Same version: keep the object so the body is not refetched. New object id means the guide
      // was saved again, and swapping it in is what pulls the edited content into the open panel.
      return match.objectId === current.objectId ? current : match
    })
  }, [guides])

  /* -------------------------------------------------------------- close -- */

  // No outside-click dismissal: a guide is read while working through the screen it describes, so
  // clicking the very field it is explaining must not close it. Escape and the header button are
  // the ways out, and Escape unwinds the zoom before the drawer.
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

  // The drawer is not modal, so focus is moved rather than trapped: it lands inside so Escape and
  // the scroll keys reach it, and returns to wherever the reader was when it closes.
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

  // Reading a manual means leaving to try the step and coming back, so the drawer returns to where
  // it was rather than to the top. Restored once the body is in the DOM.
  useEffect(() => {
    if (!active || doc.loading || doc.failed || !bodyRef.current) return
    bodyRef.current.scrollTop = scrollMemory.current[active.fileName] ?? 0
  }, [active, doc.loading, doc.failed, doc.body])

  const handleBodyScroll = useCallback((event) => {
    if (active) scrollMemory.current[active.fileName] = event.currentTarget.scrollTop
  }, [active])

  /* -------------------------------------------------------------- fetch -- */

  const { exporting, exportActive, exportRecord, savePdf, openWindow } = useDrawerExports({
    svSession, active, doc, resolveImage, cache, fmt,
  })

  // Every use of this is paired with !doc.loading, because `active` flips a render before the fetch
  // for it starts: on its own this would show a manual's chrome over the document still in state.
  const isPdf = active?.kind === PDF_KIND

  // Figures render into a column a few hundred pixels wide, which is unreadable for a screenshot.
  // Delegated rather than bound per image, because the body is replaced wholesale on every render.
  const handleBodyClick = useCallback((event) => {
    setShowToc(false)
    const image = event.target?.closest?.('img[src]')
    if (image) setZoom({ src: image.getAttribute('src'), alt: image.getAttribute('alt') ?? '' })
  }, [setShowToc])

  /**
   * The screen's own guides, and the general ones that answer everywhere.
   *
   * A guide whose route names no module is general by construction: `/main` matches every screen
   * below it, which is what makes it general in the first place. Split rather than left to the
   * sort, because "how does this screen work" and "how does the application work" are two
   * questions, and one flat list leaves the reader to work out which entries answer which.
   */
  const [screenGuides, generalGuides] = useMemo(() => {
    const screen = []
    const general = []
    guides.forEach(guide => {
      (moduleIdFromPath(guide.notes?.route) ? screen : general).push(guide)
    })
    return [screen, general]
  }, [guides])

  /**
   * The guide to open without showing the list first.
   *
   * Counted over the screen's own guides rather than all of them, because a general manual answers
   * on every route: including it would mean this shortcut stopped firing the day the first one was
   * written. One guide in total is still opened directly, general or not.
   */
  const openDirectly = useMemo(() => {
    if (guides.length === 1) return guides[0]
    if (screenGuides.length === 1) return screenGuides[0]
    return null
  }, [guides, screenGuides])

  const toggle = useCallback(() => {
    setOpen(current => {
      // One guide is the common case, so skip the list and open it directly.
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

      {/* Always mounted so opening and closing can animate. visibility:hidden in the closed state
          is what keeps its buttons out of the tab order while it is off screen. */}
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
                  {/* Iconed because the two are one word apart in most locales, and a reader
                      reaching for a manual should not have to read to tell them apart. */}
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

NavbarHelp.contextTypes = {
  intl: PropTypes.object.isRequired
}

export default NavbarHelp
