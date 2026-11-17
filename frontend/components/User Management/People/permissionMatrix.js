export const LEVELS = ['NONE', 'READ', 'WRITE', 'EXECUTE', 'MODIFY', 'FULL']

export const levelOf = (access) => Math.max(0, LEVELS.indexOf(access))

export const isSystemTable = (name) => /^SVAROG_/.test(name || '')

const toGrant = (grant) => {
  const groups = Array.isArray(grant.sourceGroups) ? grant.sourceGroups : []
  return {
    aclId: grant.aclId,
    labelCode: grant.labelCode || '',
    access: LEVELS[levelOf(grant.accessType)],
    level: levelOf(grant.accessType),
    configKey: grant.configKey || null,
    resourceId: grant.resourceId,
    groups,
    direct: groups.length === 0
  }
}

const byWeight = (a, b) => Number(Boolean(a.configKey)) - Number(Boolean(b.configKey)) || b.level - a.level ||
  a.labelCode.localeCompare(b.labelCode)

export const grantEffect = (grant, row) => {
  if (grant.configKey) return 'scoped'
  return grant.level > 0 && grant.level === row.level ? 'sets' : 'lower'
}

const toRow = (row) => {
  const level = levelOf(row.effectiveAccess)
  const grants = (Array.isArray(row.grants) ? row.grants : []).map(toGrant).sort(byWeight)
  const winners = grants.filter(grant => !grant.configKey && level > 0 && grant.level === level)
  return {
    id: row.tableId,
    name: row.tableName || '',
    labelCode: row.labelCode || '',
    level,
    scoped: row.hasScopedPermissions === true,
    grants,
    groups: [...new Set(winners.flatMap(grant => grant.groups))].sort(),
    direct: winners.some(grant => grant.direct),
    system: isSystemTable(row.tableName)
  }
}

export const readMatrix = (body) => {
  const other = (Array.isArray(body?.otherPermissions) ? body.otherPermissions : []).map(toGrant).sort(byWeight)
  return {
    bypass: body?.administratorBypass === true,
    rows: (Array.isArray(body?.data) ? body.data : []).map(toRow),
    scoped: other.filter(grant => grant.configKey),
    custom: other.filter(grant => !grant.configKey)
  }
}

export const tableLabel = (row, messages) => (row.labelCode && messages?.[row.labelCode]) || row.name

export const filterRows = (rows, { onlyWithAccess = false, system = true } = {}) => rows.filter(row =>
  (system || !row.system) && (!onlyWithAccess || row.level > 0 || row.scoped))

export const countWithAccess = (rows) => rows.filter(row => row.level > 0).length
