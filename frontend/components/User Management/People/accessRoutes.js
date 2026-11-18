import { LEVELS, levelOf, readMatrix } from './permissionMatrix'
import { sameId } from './people'

// svCONST.OBJECT_TYPE_TABLE
export const TABLE_TYPE = 50

const key = (id) => String(id)

// Java's String.compareTo, which orders the backend's TreeMap of rows.
const javaOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// WsAdminConsole.buildPermissionMatrix, on plain objects, answering as the endpoint does.
export const buildMatrix = (tables, permissions, groupsByAcl, bypass = false) => {
  const rows = new Map()
  for (const table of tables) {
    rows.set(key(table.id), {
      row: { tableId: table.id, tableName: table.name, labelCode: table.labelCode, hasScopedPermissions: false, grants: [] },
      level: bypass ? LEVELS.length - 1 : 0,
      groups: new Set()
    })
  }
  const otherPermissions = []
  const seen = new Set()
  for (const acl of permissions) {
    if (seen.has(key(acl.aclId))) continue
    seen.add(key(acl.aclId))
    const level = levelOf(acl.accessType)
    const groups = groupsByAcl.get(key(acl.aclId))
    const grant = {
      aclId: acl.aclId,
      labelCode: acl.labelCode,
      accessType: LEVELS[level],
      resourceId: acl.resourceId,
      resourceType: acl.resourceType,
      configKey: acl.configKey ?? null,
      sourceGroups: groups ? [...groups].sort(javaOrder) : []
    }
    const entry = Number(acl.resourceType) === TABLE_TYPE ? rows.get(key(acl.resourceId)) : undefined
    if (entry) {
      entry.row.grants.push(grant)
      groups?.forEach(group => entry.groups.add(group))
      if (grant.configKey) entry.row.hasScopedPermissions = true
      else if (level > entry.level) entry.level = level
    }
    if (grant.configKey || !entry) otherPermissions.push(grant)
  }
  const data = [...rows.values()].map(({ row, level, groups }) => ({
    ...row,
    effectiveAccess: LEVELS[level],
    ...Object.fromEntries(LEVELS.map((name, index) => [name, index === level])),
    sourceGroups: [...groups].sort(javaOrder)
  })).sort((a, b) => javaOrder(`${a.tableName}:${a.tableId}`, `${b.tableName}:${b.tableId}`))
  return { data, otherPermissions, administratorBypass: bypass }
}

const toAcl = (grant) => ({
  aclId: grant.aclId,
  labelCode: grant.labelCode || '',
  accessType: grant.accessType,
  resourceId: grant.resourceId,
  resourceType: grant.resourceType,
  configKey: grant.configKey ?? null
})

// The person's grants as the endpoint saw them, to replay with a group joined, left, raised or lowered.
export const accessState = (body) => {
  const tables = (Array.isArray(body?.data) ? body.data : [])
    .map(row => ({ id: row.tableId, name: row.tableName || '', labelCode: row.labelCode || '' }))
  const permissions = []
  const groupsByAcl = new Map()
  const direct = new Set()
  const add = (grant) => {
    if (groupsByAcl.has(key(grant.aclId)) || direct.has(key(grant.aclId))) return
    permissions.push(toAcl(grant))
    const groups = Array.isArray(grant.sourceGroups) ? grant.sourceGroups : []
    if (groups.length) groupsByAcl.set(key(grant.aclId), new Set(groups))
    else direct.add(key(grant.aclId))
  }
  for (const row of Array.isArray(body?.data) ? body.data : []) (row.grants || []).forEach(add)
  ;(Array.isArray(body?.otherPermissions) ? body.otherPermissions : []).forEach(add)
  return { tables, permissions, groupsByAcl, direct, bypass: body?.administratorBypass === true }
}

export const matrixOf = (state) =>
  readMatrix(buildMatrix(state.tables, state.permissions, state.groupsByAcl, state.bypass))

const copy = (state) => ({
  ...state,
  permissions: [...state.permissions],
  groupsByAcl: new Map([...state.groupsByAcl].map(([id, groups]) => [id, new Set(groups)]))
})

const isTableGrant = (acl, tableId) =>
  Number(acl.resourceType) === TABLE_TYPE && sameId(acl.resourceId, tableId) && !acl.configKey

const holds = (state, group, acl) => state.groupsByAcl.get(key(acl.aclId))?.has(group) === true

export const groupPermissions = (state, group) => state.permissions.filter(acl => holds(state, group, acl))

export const levelGiven = (permissions, tableId) =>
  permissions.filter(acl => isTableGrant(acl, tableId)).reduce((top, acl) => Math.max(top, levelOf(acl.accessType)), 0)

const giveTo = (state, group, acls) => {
  for (const acl of acls) {
    const id = key(acl.aclId)
    if (!state.permissions.some(own => key(own.aclId) === id)) state.permissions.push(acl)
    const groups = state.groupsByAcl.get(id)
    if (groups) groups.add(group)
    else state.groupsByAcl.set(id, new Set([group]))
  }
}

const takeFrom = (state, group, test) => {
  state.permissions = state.permissions.filter(acl => {
    const id = key(acl.aclId)
    const groups = state.groupsByAcl.get(id)
    if (!groups?.has(group) || !test(acl)) return true
    groups.delete(group)
    if (groups.size) return true
    state.groupsByAcl.delete(id)
    return state.direct.has(id)
  })
}

export const joinGroup = (state, group, acls) => {
  const next = copy(state)
  giveTo(next, group, acls)
  return next
}

export const leaveGroup = (state, group) => {
  const next = copy(state)
  takeFrom(next, group, () => true)
  return next
}

export const raiseGroup = (state, group, acl) => joinGroup(state, group, [acl])

// The group holds `acl` alone on the table afterwards, or nothing when there is no acl.
export const setGroupTableLevel = (state, group, tableId, acl) => {
  const next = copy(state)
  takeFrom(next, group, own => isTableGrant(own, tableId))
  if (acl) giveTo(next, group, [acl])
  return next
}

export const revokeCode = (state, group, labelCode) => {
  const next = copy(state)
  takeFrom(next, group, own => own.labelCode === labelCode)
  return next
}

export const lowerGroup = (state, group, tableId, level, acl) => {
  const next = copy(state)
  takeFrom(next, group, own => isTableGrant(own, tableId) && levelOf(own.accessType) > level)
  const keeps = groupPermissions(next, group).some(own => isTableGrant(own, tableId) && levelOf(own.accessType) === level)
  if (level > 0 && acl && !keeps) giveTo(next, group, [acl])
  return next
}

export const tablePermission = (catalog, table, level) => {
  const labelCode = `${table.name}.${LEVELS[level]}`
  const aclId = catalog.get(`${table.id}|${labelCode}`)
  if (aclId === undefined || level <= 0) return null
  return { aclId, labelCode, accessType: LEVELS[level], resourceId: table.id, resourceType: TABLE_TYPE, configKey: null }
}

export const diffMatrix = (before, after) => {
  const was = new Map(before.rows.map(row => [key(row.id), row.level]))
  const tables = after.rows
    .filter(row => (was.get(key(row.id)) ?? 0) !== row.level)
    .map(row => ({ row, from: was.get(key(row.id)) ?? 0, to: row.level }))
  const others = (matrix) => new Map([...matrix.scoped, ...matrix.custom].map(grant => [key(grant.aclId), grant]))
  const had = others(before)
  const has = others(after)
  return {
    tables,
    gained: [...has].filter(([id]) => !had.has(id)).map(([, grant]) => grant),
    lost: [...had].filter(([id]) => !has.has(id)).map(([, grant]) => grant)
  }
}

export const sideChanges = (effect, tableId) =>
  effect.tables.filter(change => !sameId(change.row.id, tableId)).length + effect.gained.length + effect.lost.length

const rowIn = (matrix, tableId) => matrix.rows.find(row => sameId(row.id, tableId))

const othersIn = (members, group, userName) => {
  const list = members?.get(group.name)
  return list ? list.filter(name => name !== userName) : null
}

const outcome = (before, after, tableId) => {
  const effect = diffMatrix(before, after)
  const row = rowIn(after, tableId)
  return { effect, side: sideChanges(effect, tableId), result: row?.level ?? 0, through: row?.groups ?? [], direct: row?.direct === true }
}

/*
 * Ways to raise one table to `level` for the person: join a group that gives it, or raise one of their groups.
 * The one with the fewest side effects comes first: other changes for the person, then other members reached.
 */
export const raiseRoutes = ({ state, tableId, level, groups, candidates = [], members, catalog, userName }) => {
  const before = matrixOf(state)
  const table = state.tables.find(each => sameId(each.id, tableId))
  if (!table || state.bypass) return []
  const routes = []
  for (const candidate of candidates) {
    if (groups.some(own => sameId(own.id, candidate.id)) || levelGiven(candidate.permissions, tableId) < level) continue
    routes.push({
      key: `join:${candidate.id}`,
      kind: 'join',
      group: { id: candidate.id, name: candidate.name },
      others: [],
      steps: [{ op: 'add', groupId: candidate.id }],
      ...outcome(before, matrixOf(joinGroup(state, candidate.name, candidate.permissions)), tableId)
    })
  }
  const acl = tablePermission(catalog, table, level)
  if (acl) {
    for (const group of groups) {
      routes.push({
        key: `raise:${group.id}`,
        kind: 'raise',
        group: { id: group.id, name: group.name },
        others: othersIn(members, group, userName),
        steps: [{ op: 'grant', groupId: group.id, codes: [acl.labelCode] }],
        ...outcome(before, matrixOf(raiseGroup(state, group.name, acl)), tableId)
      })
    }
  }
  const score = (route) => route.side + (route.others?.length ?? 0) + (route.result > level ? 0.5 : 0)
  // On a tie, joining wins: it changes only this person, while a raised group reaches its future members too.
  const kinds = (route) => (route.kind === 'join' ? 0 : 1)
  return routes.sort((a, b) => score(a) - score(b) || kinds(a) - kinds(b) || a.group.name.localeCompare(b.group.name))
}

/*
 * Lowering one table to `level` means every grant above it has to go: per group, the person leaves it or the group
 * is lowered. A default group can only be lowered (Svarog wants a replacement first), and direct grants stay.
 */
export const lowerPlan = ({ state, tableId, level, groups, members, catalog, userName, choices = {} }) => {
  const before = matrixOf(state)
  const table = state.tables.find(each => sameId(each.id, tableId))
  const blocking = state.permissions.filter(acl => isTableGrant(acl, tableId) && levelOf(acl.accessType) > level)
  const directLevel = blocking.filter(acl => state.direct.has(key(acl.aclId)))
    .reduce((top, acl) => Math.max(top, levelOf(acl.accessType)), 0)
  const names = new Set(blocking.flatMap(acl => [...(state.groupsByAcl.get(key(acl.aclId)) || [])]))
  const acl = table ? tablePermission(catalog, table, level) : null

  const blockers = groups.filter(group => names.has(group.name)).map(group => {
    const leave = outcome(before, matrixOf(leaveGroup(state, group.name)), tableId)
    const others = othersIn(members, group, userName)
    const reached = others?.length ?? 0
    const auto = group.isDefault || leave.side > reached ? 'lower' : 'leave'
    const choice = group.isDefault ? 'lower' : choices[key(group.id)] || auto
    return {
      group,
      level: levelGiven(groupPermissions(state, group.name), tableId),
      canLeave: !group.isDefault,
      leaveSide: leave.side,
      others,
      choice
    }
  })

  let after = state
  const grants = []
  const revokes = []
  const removes = []
  for (const blocker of blockers) {
    const { group } = blocker
    if (blocker.choice === 'leave') {
      after = leaveGroup(after, group.name)
      removes.push({ op: 'remove', groupId: group.id })
      continue
    }
    const held = groupPermissions(after, group.name)
    const above = held.filter(own => isTableGrant(own, tableId) && levelOf(own.accessType) > level)
    const keeps = held.some(own => isTableGrant(own, tableId) && levelOf(own.accessType) === level)
    if (level > 0 && acl && !keeps) grants.push({ op: 'grant', groupId: group.id, codes: [acl.labelCode] })
    // Some tables carry every code twice; a revoke drops one copy, so each copy held is named.
    revokes.push({ op: 'revoke', groupId: group.id, codes: above.map(own => own.labelCode) })
    after = lowerGroup(after, group.name, tableId, level, acl)
  }
  const lowered = blockers.filter(blocker => blocker.choice === 'lower')
  const others = [...new Set(lowered.flatMap(blocker => blocker.others || []))].sort()
  return {
    blockers,
    directLevel,
    others,
    unknownOthers: lowered.some(blocker => !blocker.others),
    // A grant first, so the table never drops below the target partway through.
    steps: [...grants, ...revokes, ...removes],
    ...outcome(before, matrixOf(after), tableId)
  }
}
