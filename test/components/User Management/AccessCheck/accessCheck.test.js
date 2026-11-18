import { describe, expect, it } from 'vitest'
import { checkCode, checkTable, codeRoutes } from '../../../../frontend/components/User Management/AccessCheck/accessCheck'
import { accessState } from '../../../../frontend/components/User Management/People/accessRoutes'
import { readMatrix } from '../../../../frontend/components/User Management/People/permissionMatrix'

const acl = (aclId, resourceId, accessType, labelCode, configKey = null) =>
  ({ aclId, labelCode, accessType, resourceId, resourceType: 50, configKey })

const READ = acl(1, 10, 'READ', 'ANIMAL.READ')
const WRITE = acl(2, 10, 'WRITE', 'ANIMAL.WRITE')
const SCOPED = acl(3, 10, 'FULL', 'Clinic', 'holding.type.clinic')
const CARD = acl(4, 0, 'READ', 'card.lims_access', 'card.lims_access')
const HOLDING = acl(5, 11, 'READ', 'HOLDING.READ')

const body = (grants, bypass = false) => ({
  administratorBypass: bypass,
  data: [
    { tableId: 10, tableName: 'ANIMAL', effectiveAccess: 'NONE', grants: [] },
    { tableId: 11, tableName: 'HOLDING', effectiveAccess: 'NONE', grants: [] },
  ].map(row => {
    const own = grants.filter(([g]) => g.resourceId === row.tableId).map(([g, groups]) => ({ ...g, sourceGroups: groups }))
    const top = own.filter(g => !g.configKey).reduce((max, g) => Math.max(max, ['NONE', 'READ', 'WRITE'].indexOf(g.accessType)), 0)
    return { ...row, grants: own, effectiveAccess: bypass ? 'FULL' : ['NONE', 'READ', 'WRITE'][top] }
  }),
  otherPermissions: grants.filter(([g]) => g.resourceId === 0 || g.configKey).map(([g, groups]) => ({ ...g, sourceGroups: groups })),
})

describe('checkTable', () => {
  it('says yes at or above the level, through the groups that set it', () => {
    const matrix = readMatrix(body([[READ, ['VETS']], [WRITE, ['WMS']]]))
    expect(checkTable(matrix, 10, 2)).toMatchObject({ verdict: 'yes', level: 2, groups: ['WMS'], direct: false })
    expect(checkTable(matrix, 10, 3)).toMatchObject({ verdict: 'no', level: 2 })
  })

  it('names scoped grants, which cover part of the table only', () => {
    const matrix = readMatrix(body([[SCOPED, ['VETS']]]))
    expect(checkTable(matrix, 10, 1)).toMatchObject({ verdict: 'no', level: 0, scoped: ['holding.type.clinic'] })
  })

  it('answers yes for an administrator, and nothing for an unknown table', () => {
    const matrix = readMatrix(body([], true))
    expect(checkTable(matrix, 10, 5)).toMatchObject({ verdict: 'bypass' })
    expect(checkTable(matrix, 99, 1)).toBeNull()
  })
})

describe('checkCode', () => {
  it('finds a custom code and the groups behind it', () => {
    const matrix = readMatrix(body([[CARD, ['VETS', 'LAB']]]))
    expect(checkCode(matrix, 4)).toEqual({ verdict: 'yes', groups: ['LAB', 'VETS'], direct: false })
    expect(checkCode(matrix, '4').verdict).toBe('yes')
    expect(checkCode(matrix, 3)).toEqual({ verdict: 'no', groups: [], direct: false })
  })

  it('reads a code held with no group as direct', () => {
    expect(checkCode(readMatrix(body([[CARD, []]])), 4)).toMatchObject({ verdict: 'yes', direct: true })
  })

  it('answers yes for an administrator', () => {
    expect(checkCode(readMatrix(body([], true)), 4).verdict).toBe('bypass')
  })
})

describe('codeRoutes', () => {
  const state = accessState(body([[READ, ['VETS']]]))
  const groups = [{ id: 1, name: 'VETS' }]

  it('offers the groups that hold the code, fewest other changes first', () => {
    const candidates = [
      { id: 3, name: 'BIG', permissions: [CARD, WRITE, HOLDING] },
      { id: 2, name: 'LAB', permissions: [CARD] },
      { id: 4, name: 'OTHER', permissions: [HOLDING] },
    ]
    const routes = codeRoutes({ state, aclId: 4, groups, candidates })
    expect(routes.map(route => [route.group.name, route.side])).toEqual([['LAB', 0], ['BIG', 2]])
    expect(routes[0].steps).toEqual([{ op: 'add', groupId: 2 }])
    expect(routes[1].effect.tables.map(change => change.row.name)).toEqual(['ANIMAL', 'HOLDING'])
  })

  it("leaves out the person's own groups, and offers nothing to an administrator", () => {
    const candidates = [{ id: 1, name: 'VETS', permissions: [CARD] }]
    expect(codeRoutes({ state, aclId: 4, groups, candidates })).toEqual([])
    expect(codeRoutes({ state: accessState(body([], true)), aclId: 4, groups: [], candidates })).toEqual([])
  })
})
