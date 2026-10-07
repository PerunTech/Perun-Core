/**
 * The figure references a Markdown document carries.
 *
 * Deliberately a scan rather than a parse: the editor runs this alongside typing, where a full
 * parse-and-sanitize pass would repeat the render cost for no extra information. Raw <img> tags are
 * rendered correctly by the preview but are not reported here, which is fine for every caller: the
 * editor prefetches from it, and the exporters use it to decide which files to carry along.
 *
 * Kept in one place because the reader, the editor, the archive and the PDF all have to agree on
 * what counts as a figure. A reference form got right in three of them and wrong in the fourth is a
 * figure that silently goes missing from one surface.
 */

// Two destination forms, because a document written elsewhere uses either: bare, and angle
// bracketed, which is how a name carrying a space has to be written for Markdown to parse it at
// all. A title after the destination is left out of both.
const IMAGE_REF = /!\[[^\]]*\]\(\s*(?:<([^>]*)>|([^)\s]+))/g

/**
 * The name a reference means, with percent escapes undone.
 *
 * Decoded because that is the one spelling every surface can agree on. marked percent-encodes the
 * destination it renders, so `снимка.png` reaches the resolver as `%D1%81...` while the figure map
 * is keyed by what the author wrote; and a document authored elsewhere writes a space as `%20` or
 * inside angle brackets while the archive beside it holds a file with a real space in its name.
 * Decoding both ends is what makes those the same figure.
 *
 * A malformed escape is left as it stands rather than throwing: it is a reference that will not
 * resolve either way, and it should surface as a missing figure, not as a failed render.
 */
const decodeName = (name) => {
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

/** Every figure name a document references, in document order, without repeats. */
export const figureNames = (markdown) => {
  const names = []
  for (const match of String(markdown ?? '').matchAll(IMAGE_REF)) {
    const name = decodeName(match[1] ?? match[2])
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export { decodeName as figureName }
