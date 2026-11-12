export const META_KEYS = ['OBJECT_ID', 'OBJECT_TYPE', 'PKID', 'PARENT_ID', 'recordType']

export const FLAG_META = [
  { key: 'SYSTEM_TABLE', label: 'SYSTEM', color: '#7c3aed' },
  { key: 'REPO_TABLE', label: 'REPO', color: '#0891b2' },
  { key: 'IS_CONFIG_TABLE', label: 'CONFIG', color: '#d97706' },
]

export const FIELD_UISCHEMA_OVERRIDE = {
  'ui:order': ['FIELD_NAME', 'LABEL_CODE', 'FIELD_TYPE', 'FIELD_SIZE', 'SORT_ORDER', 'CODE_LIST_MNEMONIC', 'IS_NULL', 'IS_UNIQUE', 'IS_PRIMARY_KEY', 'INDEX_NAME', '*'],
}

export const TABLE_UISCHEMA_OVERRIDE = {
  'ui:order': ['TABLE_NAME', 'SCHEMA', 'REPO_NAME', 'LABEL_CODE', 'SYSTEM_TABLE', 'REPO_TABLE', 'IS_CONFIG_TABLE', 'USE_CACHE', 'CACHE_TYPE', 'CACHE_SIZE', 'CACHE_EXPIRY', '*'],
  TABLE_NAME: { 'ui:classNames': 'stp-edit-field' },
  SCHEMA: { 'ui:classNames': 'stp-edit-field' },
  REPO_NAME: { 'ui:classNames': 'stp-edit-field' },
  LABEL_CODE: { 'ui:classNames': 'stp-edit-field' },
  SYSTEM_TABLE: { 'ui:classNames': 'stp-edit-toggle stp-section-start', 'ui:widget': 'CustomCheckboxWidget', 'ui:label': false, 'ui:options': { color: '#7c3aed' } },
  REPO_TABLE: { 'ui:classNames': 'stp-edit-toggle', 'ui:widget': 'CustomCheckboxWidget', 'ui:label': false, 'ui:options': { color: '#0891b2' } },
  IS_CONFIG_TABLE: { 'ui:classNames': 'stp-edit-toggle', 'ui:widget': 'CustomCheckboxWidget', 'ui:label': false, 'ui:options': { color: '#d97706' } },
  USE_CACHE: { 'ui:classNames': 'stp-edit-toggle stp-section-start stp-use-cache-toggle', 'ui:widget': 'CustomCheckboxWidget', 'ui:label': false, 'ui:options': { color: '#059669' } },
  CACHE_TYPE: { 'ui:classNames': 'stp-edit-field' },
  CACHE_SIZE: { 'ui:classNames': 'stp-edit-field' },
  CACHE_EXPIRY: { 'ui:classNames': 'stp-edit-field' },
  CONFIG_UNQ_ID: { 'ui:classNames': 'stp-edit-field stp-section-start' },
  CONFIG_TYPE_ID: { 'ui:classNames': 'stp-edit-field' },
  CONFIG_RELATION_TYPE: { 'ui:classNames': 'stp-edit-field' },
  CONFIG_RELATION_ID: { 'ui:classNames': 'stp-edit-field' },
  EXTENDED_PARAMS: { 'ui:widget': 'hidden' }
}

export const isTrue = (v) => v === true || v === 'true' || v === 1

export const normalizeRow = (prefix, row) => {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.startsWith(prefix) ? k.slice(prefix.length) : k] = v
  }
  return out
}

export const normalizeField = (row) => normalizeRow('SVAROG_FIELDS.', row)

export const parseDbDataArray = (response) => {
  const items = response?.['com.prtech.svarog_common.DbDataArray']?.items
  if (!Array.isArray(items)) return []
  return items.map(item => {
    const dbo = item['com.prtech.svarog_common.DbDataObject']
    if (!dbo) return null
    return {
      OBJECT_ID: dbo.object_id,
      PKID: dbo.pkid,
      PARENT_ID: dbo.parent_id,
      OBJECT_TYPE: dbo.object_type,
      ...Object.assign({}, ...(dbo.values || [])),
    }
  }).filter(Boolean)
}

export const formDataToValues = (formData) =>
  Object.entries(formData)
    .filter(([key]) => !META_KEYS.includes(key))
    .map(([key, value]) => ({ [key]: value }))

export const formDataToDbDataObject = (formData, userId) => ({
  'com.prtech.svarog_common.DbDataObject': {
    pkid: formData.PKID || 0,
    object_id: formData.OBJECT_ID || 0,
    dt_insert: new Date().toISOString(),
    dt_delete: '9999-12-31T02:00:00.000Z',
    parent_id: formData.PARENT_ID || 0,
    object_type: formData.OBJECT_TYPE || 0,
    status: 'VALID',
    user_id: userId,
    values: formDataToValues(formData)
  }
})

export const applyFormDataOverrides = (items, overrides) => {
  for (const item of items) {
    const dbDataObject = item['com.prtech.svarog_common.DbDataObject']
    if (!dbDataObject) continue
    const override = overrides.find(o => o.OBJECT_ID === dbDataObject.object_id)
    if (override) {
      const overrideMap = Object.fromEntries(formDataToValues(override).map(e => Object.entries(e)[0]))
      dbDataObject.values = dbDataObject.values.map(entry => {
        const key = Object.keys(entry)[0]
        return key in overrideMap ? { [key]: overrideMap[key] } : entry
      })
      const existingKeys = new Set(dbDataObject.values.map(e => Object.keys(e)[0]))
      for (const [key, val] of Object.entries(overrideMap)) {
        if (!existingKeys.has(key)) dbDataObject.values.push({ [key]: val })
      }
    }
  }
}

export const fetchInBatches = async (items, batchSize, fetchFn) => {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    results.push(...await Promise.all(batch.map(fetchFn)))
  }
  return results
}

export const downloadJson = (data, fileName) => {
  if (!data) return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.json`
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
