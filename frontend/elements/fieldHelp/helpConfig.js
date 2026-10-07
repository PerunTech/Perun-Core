const labelTextCache = {}

export function clearLabelTextCache() {
  Object.keys(labelTextCache).forEach(k => delete labelTextCache[k])
}

export async function fetchLabelText(labelCode, svSession, locale) {
  if (labelTextCache[labelCode] !== undefined) return labelTextCache[labelCode]
  const url = `${window.server}/ReactElements/getTableWithFilter/${svSession}/SVAROG_LABELS/LABEL_CODE/${labelCode}/0`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const localeId = locale ? locale.replace('-', '_') : null
    const row = localeId ? data?.find(r => r['SVAROG_LABELS.LOCALE_ID'] === localeId) : data?.[0]
    const text = row?.['SVAROG_LABELS.LABEL_DESCR'] || row?.['SVAROG_LABELS.LABEL_TEXT'] || ''
    if (text) labelTextCache[labelCode] = text
    return text
  } catch {
    return ''
  }
}
