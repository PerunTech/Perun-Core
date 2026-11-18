import { describe, expect, it } from 'vitest'
import {
  TABLE_TYPE, accessState, buildMatrix, diffMatrix, joinGroup, leaveGroup, lowerPlan, matrixOf, raiseRoutes,
  tablePermission,
} from '../../../../frontend/components/User Management/People/accessRoutes'
import { catalogIndex, readAcls } from '../../../../frontend/components/User Management/People/aclCatalog'
import { LEVELS } from '../../../../frontend/components/User Management/People/permissionMatrix'

const USER_TYPE = 57

const acl = (aclId, tableId, accessType, configKey = null, labelCode = `permission.${aclId}`) =>
  ({ aclId, labelCode, accessType, resourceId: tableId, resourceType: TABLE_TYPE, configKey })

const marks = (row) => LEVELS.filter(level => row[level]).length

// The cases of Perun-Core-Services' TestPermissionMatrix.
describe('buildMatrix, as WsAdminConsole.buildPermissionMatrix', () => {
  const matrix = (tables, permissions, bypass = false) => buildMatrix(tables, permissions, new Map(), bypass)

  it('lets the highest grant win, and NONE never denies', () => {
    const [row] = matrix([{ id: 10, name: 'ANIMAL' }],
      [acl(1, 10, 'READ'), acl(2, 10, 'NONE'), acl(3, 10, 'FULL'), acl(4, 10, 'WRITE')]).data
    expect(row.effectiveAccess).toBe('FULL')
    expect(row.FULL).toBe(true)
    expect(row.READ).toBe(false)
    expect(marks(row)).toBe(1)
  })

  it('includes tables without grants and sorts them by name', () => {
    const { data } = matrix([{ id: 10, name: 'ZEBRA' }, { id: 11, name: 'ANIMAL' }], [])
    expect(data.map(row => row.tableName)).toEqual(['ANIMAL', 'ZEBRA'])
    expect(data[0].tableId).toBe(11)
    expect(data[0].NONE).toBe(true)
    expect(data[0].grants).toEqual([])
  })

  it('never turns scoped or non-table grants into whole-table access', () => {
    const result = matrix([{ id: 10, name: 'SVAROG_EXECUTORS' }], [
      acl(1, 10, 'EXECUTE', 'LOGIN_USER'), acl(2, 10, 'FULL', 'ONE_CONFIG'),
      { ...acl(3, 10, 'FULL'), resourceType: USER_TYPE }, acl(4, 0, 'EXECUTE', 'CUSTOM_ACTION'),
    ])
    const [row] = result.data
    expect(row.effectiveAccess).toBe('NONE')
    expect(row.hasScopedPermissions).toBe(true)
    expect(row.grants).toHaveLength(2)
    expect(result.otherPermissions).toHaveLength(4)
    expect(row.grants[0].configKey).toBe('LOGIN_USER')
  })

  it('counts an ACL once and keeps the groups it came from', () => {
    const grant = acl(1, 10, 'READ')
    const [row] = buildMatrix([{ id: 10, name: 'ANIMAL' }], [grant, grant],
      new Map([['1', new Set(['WMS_USER', 'AUTHORIZED_VETERINARIAN'])]])).data
    expect(row.grants).toHaveLength(1)
    expect(row.sourceGroups).toHaveLength(2)
    expect(row.grants[0].sourceGroups).toEqual(['AUTHORIZED_VETERINARIAN', 'WMS_USER'])
  })

  it('orders EXECUTE below MODIFY', () => {
    const [row] = matrix([{ id: 10, name: 'ANIMAL' }], [acl(1, 10, 'WRITE'), acl(2, 10, 'EXECUTE'), acl(3, 10, 'MODIFY')]).data
    expect(row.effectiveAccess).toBe('MODIFY')
    expect(marks(row)).toBe(1)
  })

  it('reads FULL everywhere for an administrator, grants or not', () => {
    const [row] = matrix([{ id: 10, name: 'ANIMAL' }], [acl(1, 10, 'NONE')], true).data
    expect(row.effectiveAccess).toBe('FULL')
    expect(marks(row)).toBe(1)
  })
})

// Each table's code for a level is its id * 10 + the level, as TABLE.LEVEL.
const TABLES = [
  { id: 1, name: 'ANIMAL', labelCode: 'animal' },
  { id: 2, name: 'ANIMAL_MOVEMENT', labelCode: 'movement' },
  { id: 3, name: 'HOLDING', labelCode: 'holding' },
  { id: 4, name: 'LAB_RESULT', labelCode: 'lab_result' },
  { id: 5, name: 'SVAROG_CODES', labelCode: '' },
]
const code = (tableId, level) => {
  const table = TABLES.find(each => each.id === tableId)
  return acl(tableId * 10 + LEVELS.indexOf(level), tableId, level, null, `${table.name}.${level}`)
}
const CATALOG = catalogIndex(readAcls(TABLES.flatMap(table => LEVELS.map((level, index) => ({
  'SVAROG_ACL.OBJECT_ID': table.id * 10 + index,
  'SVAROG_ACL.ACCESS_TYPE': level,
  'SVAROG_ACL.ACL_OBJECT_ID': table.id,
  'SVAROG_ACL.LABEL_CODE': `${table.name}.${level}`,
}))))).tableCode

const VET = { id: 101, name: 'AUTHORIZED_VETERINARIAN', isDefault: true }
const WMS = { id: 102, name: 'WMS_USER', isDefault: false }
const USERS = { id: 103, name: 'USERS', isDefault: false }
const GROUP_ACL = {
  AUTHORIZED_VETERINARIAN: [code(1, 'WRITE'), code(3, 'READ'), code(2, 'READ'), acl(41, 4, 'READ', 'OWN_SAMPLES', 'lab_result.own')],
  WMS_USER: [code(1, 'READ'), code(3, 'READ'), code(2, 'MODIFY')],
  USERS: [code(5, 'READ')],
  LAB_TECHNICIAN: [code(1, 'READ'), code(4, 'MODIFY'), acl(90, 0, 'EXECUTE', null, 'LAB.APPROVE_RESULT')],
  INSPECTOR: [code(3, 'WRITE')],
}
const MEMBERS = new Map([
  ['AUTHORIZED_VETERINARIAN', ['EPETROVA']],
  ['WMS_USER', ['EPETROVA', 'GTRAJKOV', 'IVELKOVA']],
  ['USERS', ['EPETROVA', 'GTRAJKOV', 'IVELKOVA', 'MILIEVSKI']],
])
const CANDIDATES = [{ id: 104, name: 'LAB_TECHNICIAN' }, { id: 105, name: 'INSPECTOR' }]
  .map(group => ({ ...group, permissions: GROUP_ACL[group.name] }))

// The endpoint's answer for a person in these groups, with these direct grants.
const answer = (groups, direct = []) => {
  const groupsByAcl = new Map()
  const permissions = [...direct]
  for (const group of groups) {
    for (const grant of GROUP_ACL[group.name]) {
      permissions.push(grant)
      const id = String(grant.aclId)
      groupsByAcl.set(id, new Set([...(groupsByAcl.get(id) || []), group.name]))
    }
  }
  return buildMatrix(TABLES, permissions, groupsByAcl)
}

const ELENA = [VET, USERS, WMS]
const elena = accessState(answer(ELENA))
const levelOn = (matrix, tableId) => matrix.rows.find(row => row.id === tableId).level
const base = { groups: ELENA, members: MEMBERS, catalog: CATALOG, userName: 'EPETROVA' }

describe('replaying group changes', () => {
  it('rebuilds the answer it was read from', () => {
    const replayed = matrixOf(elena)
    expect(replayed.rows.map(row => [row.name, row.level])).toEqual([
      ['ANIMAL', 2], ['ANIMAL_MOVEMENT', 4], ['HOLDING', 1], ['LAB_RESULT', 0], ['SVAROG_CODES', 1],
    ])
    expect(replayed.rows.find(row => row.id === 2).groups).toEqual(['WMS_USER'])
  })

  it('keeps what another group still gives when one is left', () => {
    const after = matrixOf(leaveGroup(elena, 'WMS_USER'))
    expect(levelOn(after, 2)).toBe(1)
    expect(levelOn(after, 3)).toBe(1)
    expect(after.rows.find(row => row.id === 3).groups).toEqual(['AUTHORIZED_VETERINARIAN'])
  })

  it('keeps direct grants whatever groups are left', () => {
    const state = accessState(answer([WMS], [code(3, 'WRITE')]))
    expect(levelOn(matrixOf(leaveGroup(state, 'WMS_USER')), 3)).toBe(2)
  })

  it('lists permissions gained and lost besides table levels', () => {
    const effect = diffMatrix(matrixOf(elena), matrixOf(joinGroup(elena, 'LAB_TECHNICIAN', GROUP_ACL.LAB_TECHNICIAN)))
    expect(effect.tables.map(change => [change.row.name, change.from, change.to])).toEqual([['LAB_RESULT', 0, 4]])
    expect(effect.gained.map(grant => grant.labelCode)).toEqual(['LAB.APPROVE_RESULT'])
    expect(effect.lost).toEqual([])
  })
})

describe('raiseRoutes', () => {
  it('offers the groups that give the level and raising each of the person\'s groups, fewest side effects first', () => {
    const routes = raiseRoutes({ ...base, state: elena, tableId: 4, level: 4, candidates: CANDIDATES })
    expect(routes.map(route => route.key)).toEqual(['raise:101', 'join:104', 'raise:102', 'raise:103'])
    const [raiseVet, join] = routes
    expect(raiseVet).toMatchObject({ result: 4, side: 0, others: [], steps: [{ op: 'grant', groupId: 101, codes: ['LAB_RESULT.MODIFY'] }] })
    expect(join).toMatchObject({ kind: 'join', result: 4, side: 1, steps: [{ op: 'add', groupId: 104 }] })
    expect(routes[2].others).toEqual(['GTRAJKOV', 'IVELKOVA'])
  })

  it('prefers joining over raising a group when they cost the same', () => {
    const routes = raiseRoutes({ ...base, state: elena, tableId: 3, level: 2, candidates: CANDIDATES })
    expect(routes.map(route => route.key)).toEqual(['join:105', 'raise:101', 'raise:102', 'raise:103'])
  })

  it('offers no group raise when the table has no code for the level', () => {
    const routes = raiseRoutes({ ...base, catalog: new Map(), state: elena, tableId: 4, level: 4, candidates: CANDIDATES })
    expect(routes.map(route => route.key)).toEqual(['join:104'])
  })

  it('offers nothing for an administrator', () => {
    const admin = { ...elena, bypass: true }
    expect(raiseRoutes({ ...base, state: admin, tableId: 4, level: 4, candidates: CANDIDATES })).toEqual([])
  })
})

describe('lowerPlan', () => {
  it('leaves the group when nothing else changes for the person', () => {
    const plan = lowerPlan({ ...base, state: elena, tableId: 2, level: 1 })
    expect(plan.blockers.map(blocker => [blocker.group.name, blocker.level, blocker.choice, blocker.leaveSide]))
      .toEqual([['WMS_USER', 4, 'leave', 0]])
    expect(plan.steps).toEqual([{ op: 'remove', groupId: 102 }])
    expect(plan).toMatchObject({ result: 1, through: ['AUTHORIZED_VETERINARIAN'], others: [] })
  })

  it('lowers the group instead when asked, granting the target first', () => {
    const plan = lowerPlan({ ...base, state: elena, tableId: 2, level: 1, choices: { 102: 'lower' } })
    expect(plan.steps).toEqual([
      { op: 'grant', groupId: 102, codes: ['ANIMAL_MOVEMENT.READ'] },
      { op: 'revoke', groupId: 102, codes: ['ANIMAL_MOVEMENT.MODIFY'] },
    ])
    expect(plan).toMatchObject({ result: 1, through: ['AUTHORIZED_VETERINARIAN', 'WMS_USER'], others: ['GTRAJKOV', 'IVELKOVA'] })
  })

  it('only lowers a default group', () => {
    const plan = lowerPlan({ ...base, state: elena, tableId: 1, level: 1, choices: { 101: 'leave' } })
    expect(plan.blockers.map(blocker => [blocker.group.name, blocker.canLeave, blocker.choice])).toEqual([['AUTHORIZED_VETERINARIAN', false, 'lower']])
    expect(plan.steps).toEqual([
      { op: 'grant', groupId: 101, codes: ['ANIMAL.READ'] },
      { op: 'revoke', groupId: 101, codes: ['ANIMAL.WRITE'] },
    ])
    expect(plan.result).toBe(1)
  })

  it('revokes every copy of a code the group holds twice', () => {
    const copy = { ...code(2, 'MODIFY'), aclId: 924 }
    const groupsByAcl = new Map([['24', new Set(['WMS_USER'])], ['924', new Set(['WMS_USER'])]])
    const state = accessState(buildMatrix(TABLES, [code(2, 'MODIFY'), copy], groupsByAcl))
    const plan = lowerPlan({ ...base, groups: [WMS], state, tableId: 2, level: 0, choices: { 102: 'lower' } })
    expect(plan.steps).toEqual([{ op: 'revoke', groupId: 102, codes: ['ANIMAL_MOVEMENT.MODIFY', 'ANIMAL_MOVEMENT.MODIFY'] }])
    expect(plan.result).toBe(0)
  })

  it('cannot go below a direct grant', () => {
    const state = accessState(answer([USERS], [code(3, 'WRITE')]))
    const plan = lowerPlan({ ...base, groups: [USERS], state, tableId: 3, level: 0 })
    expect(plan.blockers).toEqual([])
    expect(plan.steps).toEqual([])
    expect(plan).toMatchObject({ directLevel: 2, result: 2, direct: true })
  })
})

describe('tablePermission', () => {
  it('finds a table\'s own code for a level', () => {
    expect(tablePermission(CATALOG, TABLES[1], 4)).toEqual(code(2, 'MODIFY'))
    expect(tablePermission(CATALOG, TABLES[1], 0)).toBeNull()
    expect(tablePermission(CATALOG, { id: 9, name: 'NOPE' }, 1)).toBeNull()
  })

})
