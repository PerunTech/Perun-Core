import { describe, expect, it } from 'vitest'
import {
  countWithAccess, filterRows, grantEffect, levelOf, readMatrix, tableLabel,
} from '../../../../frontend/components/User Management/People/permissionMatrix'

const grant = (aclId, accessType, sourceGroups, configKey = null) =>
  ({ aclId, labelCode: `ACL_${aclId}`, accessType, resourceId: 1, resourceType: 2, configKey, sourceGroups })

const body = {
  type: 'SUCCESS',
  administratorBypass: false,
  data: [
    {
      tableId: 1, tableName: 'ANIMAL', labelCode: 'naits.animal', effectiveAccess: 'WRITE', hasScopedPermissions: true,
      grants: [
        grant(1, 'READ', ['CLERKS']),
        grant(2, 'WRITE', ['VETS', 'INSPECTORS']),
        grant(3, 'FULL', ['VETS'], 'REGION_1'),
        grant(4, 'WRITE', []),
      ],
    },
    { tableId: 2, tableName: 'HOLDING', labelCode: 'naits.holding', effectiveAccess: 'NONE', hasScopedPermissions: false, grants: [grant(5, 'NONE', ['CLERKS'])] },
    { tableId: 3, tableName: 'SVAROG_USERS', labelCode: '', effectiveAccess: 'READ', hasScopedPermissions: false, grants: [grant(6, 'READ', [])] },
  ],
  otherPermissions: [grant(3, 'FULL', ['VETS'], 'REGION_1'), grant(7, 'EXECUTE', ['CLERKS'])],
}

describe('readMatrix', () => {
  const matrix = readMatrix(body)
  const [animal, holding, users] = matrix.rows

  it('orders levels as svarog does', () => {
    expect(levelOf('NONE')).toBe(0)
    expect(levelOf('FULL')).toBe(5)
    expect(levelOf(undefined)).toBe(0)
  })

  it('names the groups and direct grants that set the level', () => {
    expect(animal.level).toBe(2)
    expect(animal.groups).toEqual(['INSPECTORS', 'VETS'])
    expect(animal.direct).toBe(true)
    expect(users.groups).toEqual([])
    expect(users.direct).toBe(true)
  })

  it('never lets a scoped or NONE grant set the level', () => {
    expect(grantEffect(animal.grants.find(g => g.aclId === 3), animal)).toBe('scoped')
    expect(grantEffect(animal.grants.find(g => g.aclId === 1), animal)).toBe('lower')
    expect(grantEffect(animal.grants.find(g => g.aclId === 2), animal)).toBe('sets')
    expect(holding.groups).toEqual([])
    expect(grantEffect(holding.grants[0], holding)).toBe('lower')
  })

  it('lists unscoped grants first, highest level first', () => {
    expect(animal.grants.map(g => g.aclId)).toEqual([2, 4, 1, 3])
  })

  it('marks system tables and splits the other permissions', () => {
    expect(users.system).toBe(true)
    expect(animal.system).toBe(false)
    expect(matrix.scoped.map(g => g.aclId)).toEqual([3])
    expect(matrix.custom.map(g => g.aclId)).toEqual([7])
  })

  it('reads the administrator bypass and survives an empty body', () => {
    expect(readMatrix({ ...body, administratorBypass: true }).bypass).toBe(true)
    expect(readMatrix(undefined)).toEqual({ bypass: false, rows: [], scoped: [], custom: [] })
  })

  it('counts and filters tables', () => {
    expect(countWithAccess(matrix.rows)).toBe(2)
    expect(filterRows(matrix.rows, { onlyWithAccess: true }).map(r => r.name)).toEqual(['ANIMAL', 'SVAROG_USERS'])
    expect(filterRows(matrix.rows, { system: false }).map(r => r.name)).toEqual(['ANIMAL', 'HOLDING'])
    expect(filterRows(matrix.rows, { onlyWithAccess: true, system: false }).map(r => r.name)).toEqual(['ANIMAL'])
    const messages = { 'naits.holding': 'Holdings' }
    expect(tableLabel(holding, messages)).toBe('Holdings')
    expect(tableLabel(animal, messages)).toBe('ANIMAL')
  })
})
