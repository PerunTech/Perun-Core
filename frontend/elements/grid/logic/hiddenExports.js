// The exports `hidden` leaves: none for `true`, else those whose format it does not name (one name or a list).
export function shownExports(exports, hidden) {
  if (hidden === true) {
    return []
  }
  const names = (typeof hidden === 'string' ? [hidden] : Array.isArray(hidden) ? hidden : []).map((name) => String(name).toLowerCase())
  return exports.filter(({ format }) => !names.includes(format))
}
