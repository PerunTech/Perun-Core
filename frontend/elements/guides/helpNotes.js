// The routing index a help file carries in FILE_NOTES, encoded for a URL path segment.

/* ------------------------------------------------------------------ notes -- */

// FILE_NOTES travels to the server as a path segment on the upload URL, and the endpoint is
// @Encoded so whatever arrives is stored verbatim. Route values contain slashes, and a
// percent-encoded slash in a path is rejected outright by a default Tomcat configuration, so the
// index is base64url encoded: no slashes, no braces, nothing a container will argue with.
const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (encoded) => {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - padded.length % 4) % 4))
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
}

export const encodeNotes = (notes) => toBase64Url(JSON.stringify(notes ?? {}))

/**
 * Reads the routing index back off a file row. Tolerates the three forms a note can arrive in:
 * base64url written by this module, bare JSON, or percent-encoded JSON written by hand.
 */
export const decodeNotes = (raw) => {
  const text = (raw ?? '').trim()
  if (!text) return {}

  const attempts = [
    () => JSON.parse(fromBase64Url(text)),
    () => JSON.parse(text),
    () => JSON.parse(decodeURIComponent(text))
  ]

  for (const attempt of attempts) {
    try {
      const parsed = attempt()
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* try the next encoding */ }
  }
  return {}
}
