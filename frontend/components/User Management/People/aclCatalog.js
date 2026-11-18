import { LEVELS, isSystemTable, levelOf } from './permissionMatrix'
import { TABLE_TYPE } from './accessRoutes'

const key = (id) => String(id)
const aclField = (row, field) => row?.[`SVAROG_ACL.${field}`]
const sidField = (row, field) => row?.[`SVAROG_SID_ACL.${field}`]
const tableField = (row, field) => row?.[`SVAROG_TABLES.${field}`]
const list = (rows) => (Array.isArray(rows) ? rows : [])

// A code is on a table (ACL_OBJECT_ID), on part of one (ACL_CONFIG_UNQ), or on no table at all (createCustomAcl's 0).
export const readAcls = (rows) => list(rows).map(row => {
  const resourceId = aclField(row, 'ACL_OBJECT_ID')
  const configKey = aclField(row, 'ACL_CONFIG_UNQ') || null
  const level = levelOf(aclField(row, 'ACCESS_TYPE'))
  return {
    aclId: aclField(row, 'OBJECT_ID'),
    labelCode: aclField(row, 'LABEL_CODE') || '',
    accessType: LEVELS[level],
    level,
    resourceId,
    resourceType: Number(aclField(row, 'ACL_OBJECT_TYPE')) || TABLE_TYPE,
    configKey,
    kind: key(resourceId) === '0' ? 'custom' : configKey ? 'scoped' : 'table'
  }
})

export const readTables = (rows) => list(rows).map(row => ({
  id: tableField(row, 'OBJECT_ID'),
  name: tableField(row, 'TABLE_NAME') || '',
  labelCode: tableField(row, 'LABEL_CODE') || '',
  system: isSystemTable(tableField(row, 'TABLE_NAME'))
}))

// SVAROG_SID_ACL: one row per code a group or user holds, a repeat for each copy.
export const readHolders = (rows) => {
  const bySid = new Map()
  const byAcl = new Map()
  const push = (map, id, value) => {
    const items = map.get(id)
    if (items) items.push(value)
    else map.set(id, [value])
  }
  for (const row of list(rows)) {
    const sid = key(sidField(row, 'SID_OBJECT_ID'))
    const acl = key(sidField(row, 'ACL_OBJECT_ID'))
    push(bySid, sid, acl)
    push(byAcl, acl, sid)
  }
  return { bySid, byAcl }
}

export const catalogIndex = (acls) => {
  const byId = new Map()
  const byLabel = new Map()
  const byFolded = new Map()
  const tableCode = new Map()
  for (const acl of acls) {
    byId.set(key(acl.aclId), acl)
    byLabel.set(acl.labelCode, [...(byLabel.get(acl.labelCode) || []), acl])
    const folded = acl.labelCode.toUpperCase()
    if (!byFolded.has(folded)) byFolded.set(folded, acl.labelCode)
    const id = `${acl.resourceId}|${acl.labelCode}`
    if (acl.kind === 'table' && !tableCode.has(id)) tableCode.set(id, acl.aclId)
  }
  return { byId, byLabel, byFolded, tableCode }
}

const sameTarget = (a, b) => key(a.resourceId) === key(b.resourceId) && a.accessType === b.accessType &&
  (a.configKey || null) === (b.configKey || null)

// Svarog grants by label and takes one of the rows that carry it, so a label on two different permissions is a gamble.
export const isAmbiguous = (index, labelCode) => {
  const rows = index.byLabel.get(labelCode) || []
  return rows.some(acl => !sameTarget(acl, rows[0]))
}

// Table codes a grant can name safely: the label is on that one permission only.
export const grantableTableCodes = (index) => new Map([...index.tableCode]
  .filter(([id]) => !isAmbiguous(index, id.slice(id.indexOf('|') + 1))))

export const toAcl = (entry) => ({
  aclId: entry.aclId,
  labelCode: entry.labelCode,
  accessType: entry.accessType,
  resourceId: entry.resourceId,
  resourceType: entry.resourceType,
  configKey: entry.configKey
})

export const groupAcls = (holders, index, groupId) => (holders.bySid.get(key(groupId)) || [])
  .map(id => index.byId.get(id))
  .filter(Boolean)
  .map(toAcl)

export const readAclData = ({ aclRows, holderRows, groups, tableRows }) => {
  const acls = readAcls(aclRows)
  const index = catalogIndex(acls)
  const holders = readHolders(holderRows)
  const groupList = list(groups).map(group => ({ id: group.objectId, name: group.groupName || '' }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    groupsById: new Map(groupList.map(group => [key(group.id), group])),
    acls,
    index,
    grantable: grantableTableCodes(index),
    holders,
    tables: readTables(tableRows),
    groups: groupList,
    permissionsOf: (groupId) => groupAcls(holders, index, groupId)
  }
}

// Who holds a code: groups by name, and any other SID (a user) as a direct holder.
export const holdersOf = (data, aclId) => {
  const sids = data.holders.byAcl.get(key(aclId)) || []
  const groups = []
  let direct = 0
  for (const sid of new Set(sids)) {
    const group = data.groupsById.get(sid)
    if (group) groups.push(group)
    else direct++
  }
  return { groups: groups.sort((a, b) => a.name.localeCompare(b.name)), direct }
}

export const MAX_CODE = 100
const CODE = /^[A-Za-z0-9_.-]+$/

// What createCustomAcl would make of `name`: it ties the code to no table, so a table's own code name is refused.
export const checkNewCode = (name, { index, tables }) => {
  const code = String(name ?? '')
  if (!code.trim()) return { status: 'empty' }
  if (code.length > MAX_CODE) return { status: 'bad', reason: 'length', max: MAX_CODE }
  if (!CODE.test(code)) return { status: 'bad', reason: 'format' }
  if (index.byLabel.has(code)) return { status: 'bad', reason: 'exists', matches: index.byLabel.get(code) }
  const folded = index.byFolded.get(code.toUpperCase())
  if (folded) return { status: 'bad', reason: 'case', other: folded }
  const dot = code.lastIndexOf('.')
  const tableName = code.slice(0, dot).toUpperCase()
  if (dot > 0 && LEVELS.includes(code.slice(dot + 1).toUpperCase()) && tables.some(table => table.name.toUpperCase() === tableName)) {
    return { status: 'bad', reason: 'table', table: tableName }
  }
  return { status: 'ok' }
}
