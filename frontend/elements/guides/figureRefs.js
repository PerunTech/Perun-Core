// Scanned, not parsed: the editor runs this while the user types. Raw <img> tags are not reported.

// Bare or angle bracketed (how a name with a space must be written); a title after it is ignored.
const IMAGE_REF = /!\[[^\]]*\]\(\s*(?:<([^>]*)>|([^)\s]+))/g

// marked percent-encodes what it renders and other authors write a space as %20, so names compare
// decoded. A malformed escape is kept as written and shows up as a missing figure.
const decodeName = (name) => {
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

export const figureNames = (markdown) => {
  const names = []
  for (const match of String(markdown ?? '').matchAll(IMAGE_REF)) {
    const name = decodeName(match[1] ?? match[2])
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export { decodeName as figureName }
