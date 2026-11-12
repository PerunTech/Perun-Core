import { renderMarkdown } from './renderMarkdown'

// Writes into an about:blank window rather than booting the app again. Figures are the opener's blob
// URLs, so they break if the app reloads while it is open; reopening the guide fixes them.

// The bundle's <style> blocks are copied as text. Linked sheets are relinked by href: they come from
// the backend origin, where reading cssRules throws.
const inlineStyles = () =>
  [...document.querySelectorAll('style')].map(node => node.textContent).join('\n')

const copyAppStyles = (win) => {
  [...document.querySelectorAll('link[rel="stylesheet"]')].forEach(node => {
    const link = win.document.createElement('link')
    link.rel = 'stylesheet'
    // node.href is absolute, so it resolves in a document with no base URL.
    link.href = node.href
    win.document.head.appendChild(link)
  })

  // Last, so WINDOW_CSS wins over the app's global body rules.
  const style = win.document.createElement('style')
  style.textContent = `${inlineStyles()}\n${WINDOW_CSS}`
  win.document.head.appendChild(style)
}

// The --md-* tokens are declared on .md-editor and .help-panel, which this window doesn't have.
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
/* Undoes the shell's body { height: 100vh; overflow: hidden }, which would clip the guide, and
   answers its !important background in kind. */
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
/* The reader sizes this window, so type and gutters scale with it; the measure stays capped in ch. */
.help-window-doc {
  font-size: clamp(13.5px, 0.4vw + 12px, 17px);
  max-width: 72ch;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 32px) clamp(14px, 2.6vw, 24px) 64px;
}
.help-window-doc img { max-width: 100%; height: auto; }
/* Tables scroll through the shared .md-preview rule. */
.help-window-doc pre { max-width: 100%; overflow-x: auto; }

@media print {
  .help-window-bar { display: none; }
  /* Fixed for print: vw would size the type off the paper. */
  .help-window-doc { max-width: none; padding: 0; font-size: 13.5px; }

  /* Capped at a page so a screenshot moves to the next page whole instead of being sliced.
     break-inside needs a block box. */
  .help-window-doc img {
    display: block;
    max-height: 90vh;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .help-window-doc p { break-inside: avoid; page-break-inside: avoid; }
}
`

// One window per document; a window name must be a token.
const windowName = (record) =>
  `perun_help_${record?.locale ?? ''}_${record?.slug ?? ''}`.replace(/[^\w]/g, '_')

const openGuideWindow = (record) => {
  const win = window.open('', windowName(record), 'width=780,height=940,scrollbars=yes,resizable=yes')
  if (!win) return null

  win.document.open()
  win.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  win.document.close()
  win.focus()
  return win
}

// body is Markdown with the front matter already stripped.
const renderGuideWindow = (win, { title, body, resolveImage, actions = [] }) => {
  if (!win || win.closed) return false

  // A reopened guide reuses the named window, so it is rewritten, not appended to.
  win.document.open()
  win.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  win.document.close()

  // A property, not markup, so a title with markup characters can't escape into the document.
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

// The caller must already hold the body and the renderer: window.open only works inside the click.
export const openHelpWindow = (record, options) => {
  const win = openGuideWindow(record)
  return win ? renderGuideWindow(win, options) : false
}
