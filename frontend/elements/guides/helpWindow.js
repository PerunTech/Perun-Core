import { renderMarkdown } from './renderMarkdown'

/**
 * Opens one guide in its own browser window.
 *
 * The window is populated directly rather than pointed at a URL, so it costs nothing: no route, no
 * second boot of the application, no repeated fetch. The nodes come from the same renderer the
 * drawer uses, imported into the new document, so the popup can never drift from the panel.
 *
 * Figures keep working because a window opened on about:blank is same origin, and blob URLs minted
 * by the opener resolve in it. The corollary is that they die with the opening document: a full
 * reload of the application leaves an already-open guide window with broken figures. Reopening it
 * from the drawer fixes that, which is the trade for not booting the app twice.
 */

// Styles reach the application two ways and the popup needs both. The bundle injects its own as
// <style> blocks (see vite.config.mjs), which are copied across as text; the deployment's assets
// project is linked from index.html as files, which are relinked by href rather than read, because
// those files are served from the backend origin and reading cssRules across origins throws.
//
// Nothing in either matches the popup's markup except the md-preview rules, which is the point.
const inlineStyles = () =>
  [...document.querySelectorAll('style')].map(node => node.textContent).join('\n')

/** Copies the application's styling into the popup. */
const copyAppStyles = (win) => {
  [...document.querySelectorAll('link[rel="stylesheet"]')].forEach(node => {
    const link = win.document.createElement('link')
    link.rel = 'stylesheet'
    // The href property is already absolute, so it resolves from a document with no base URL.
    link.href = node.href
    win.document.head.appendChild(link)
  })

  // Appended after the links so it wins the cascade on ties, which is what lets WINDOW_CSS
  // override a global body rule the application carries.
  const style = win.document.createElement('style')
  style.textContent = `${inlineStyles()}\n${WINDOW_CSS}`
  win.document.head.appendChild(style)
}

// The --md-* tokens are declared on .md-editor and .help-panel, neither of which exists here, so
// the preview rules would resolve to nothing without this. Appended after the app styles so it
// also wins over any global body rule they carry.
const WINDOW_CSS = `
:root {
  --md-bg: #ffffff;
  --md-sunk: #f4f5f6;
  --md-border: #d9dee2;
  --md-text: #1f2a2e;
  --md-muted: #6b787e;
  --md-accent: #87adbd;
  --md-radius: 3px;
}
/* The deployment's shell pins the page so the application can manage its own scroll regions, and
   that rule is copied in with everything else: body { height: 100vh; overflow: hidden } leaves the
   guide clipped at the window edge with nothing to scroll. Overriding those two hands the document
   back to normal flow. The same rule paints the app's grey ground with !important, which a plain
   declaration cannot beat, so the guide's own ground has to answer in kind. */
html, body {
  margin: 0;
  padding: 0;
  height: auto;
  overflow: visible;
  background: var(--md-bg) !important;
  color: var(--md-text);
}
.help-window-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: clamp(8px, 1.4vw, 12px) clamp(12px, 2.6vw, 22px);
  background: var(--md-sunk);
  border-bottom: 1px solid var(--md-border);
}
.help-window-bar h1 {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.help-window-bar button {
  padding: 4px 12px;
  font-size: 13px;
  color: var(--md-text);
  background: var(--md-bg);
  border: 1px solid var(--md-border);
  border-radius: var(--md-radius);
  cursor: pointer;
}
.help-window-bar button:hover { background: var(--md-sunk); }
/* The drawer is a panel of fixed width, so the 13.5px base .md-preview sets is right there. A
   standalone window is a reading surface the reader sizes themselves, so the type and the gutters
   scale with it here. The measure stays capped in ch, which means a wider window buys wider
   margins rather than a longer, harder to track line. Everything below the base is already
   expressed in em, so headings, code and tables follow on their own. */
.help-window-doc {
  font-size: clamp(13.5px, 0.4vw + 12px, 17px);
  max-width: 72ch;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 32px) clamp(14px, 2.6vw, 24px) 64px;
}
.help-window-doc img { max-width: 100%; height: auto; }
/* Tables are handled by the shared .md-preview rule, which gives them a scroll container. */
.help-window-doc pre { max-width: 100%; overflow-x: auto; }

@media print {
  .help-window-bar { display: none; }
  /* Pinned rather than left to the clamp: vw resolves against the page box when printing, so the
     type would size itself off the paper rather than off anything the reader chose. */
  .help-window-doc { max-width: none; padding: 0; font-size: 13.5px; }

  /* A figure taller than the space left on the page is sliced across the break rather than moved
     down, which cuts a screenshot in half. The cap is what actually fixes that: an image that fits
     a page on its own is moved whole instead of split. vh resolves against the page box in paged
     media, so this follows whatever paper the reader picks rather than assuming A4. Made a block
     first, because break-inside has no effect on an inline box. */
  .help-window-doc img {
    display: block;
    max-height: 90vh;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .help-window-doc p { break-inside: avoid; page-break-inside: avoid; }
}
`

/** A window name has to be a token, and one per document keeps two guides from clobbering each other. */
const windowName = (record) =>
  `perun_help_${record?.locale ?? ''}_${record?.slug ?? ''}`.replace(/[^\w]/g, '_')

/**
 * Opens the window, empty.
 *
 * @returns {Window|null} null when the browser blocked it
 */
const openGuideWindow = (record) => {
  const win = window.open('', windowName(record), 'width=780,height=940,scrollbars=yes,resizable=yes')
  if (!win) return null

  win.document.open()
  win.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  win.document.close()
  win.focus()
  return win
}

/**
 * @param {string}   title         heading to show in the window's own bar
 * @param {string}   body          markdown, front matter already stripped
 * @param {Function} resolveImage  figure name to object URL
 * @param {object[]} actions       { label, onClick }, one button each, in the order given
 * @returns {boolean} false when the browser blocked the popup
 */
const renderGuideWindow = (win, { title, body, resolveImage, actions = [] }) => {
  if (!win || win.closed) return false

  // Reopening reuses the named window, so it is rewritten from scratch rather than appended to.
  win.document.open()
  win.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  win.document.close()

  // Set as a property rather than written into the markup, so a title containing markup characters
  // cannot escape into the document.
  win.document.title = title

  copyAppStyles(win)

  const bar = win.document.createElement('div')
  bar.className = 'help-window-bar'
  const label = win.document.createElement('h1')
  label.textContent = title
  bar.appendChild(label)

  actions.forEach(({ label: text, onClick }) => {
    const button = win.document.createElement('button')
    button.type = 'button'
    button.textContent = text
    button.addEventListener('click', onClick)
    bar.appendChild(button)
  })

  const article = win.document.createElement('article')
  article.className = 'md-preview help-window-doc'
  article.appendChild(win.document.importNode(renderMarkdown(body, resolveImage), true))

  win.document.body.appendChild(bar)
  win.document.body.appendChild(article)
  win.focus()
  return true
}

/**
 * Opens one guide in its own window.
 *
 * The caller has to hold the body already: window.open is only permitted inside the click that
 * asked for it, so there is nowhere in here to wait for a fetch.
 */
export const openHelpWindow = (record, options) => {
  const win = openGuideWindow(record)
  return win ? renderGuideWindow(win, options) : false
}
