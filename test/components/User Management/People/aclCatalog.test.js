import { describe, expect, it } from 'vitest'
import {
  catalogIndex, checkNewCode, groupAcls, holdersOf, isAmbiguous, readAclData, readAcls, readHolders, readTables,
} from '../../../../frontend/components/User Management/People/aclCatalog'

const aclRow = (id, tableId, code, access = 'READ', unq) => ({
  'SVAROG_ACL.OBJECT_ID': id,
  'SVAROG_ACL.ACL_OBJECT_ID': tableId,
  'SVAROG_ACL.ACL_OBJECT_TYPE': 50,
  'SVAROG_ACL.LABEL_CODE': code,
  'SVAROG_ACL.ACCESS_TYPE': access,
  ...(unq ? { 'SVAROG_ACL.ACL_CONFIG_UNQ': unq } : {}),
})
const sidRow = (sid, acl) => ({ 'SVAROG_SID_ACL.SID_OBJECT_ID': sid, 'SVAROG_SID_ACL.ACL_OBJECT_ID': acl })
const tableRow = (id, name) => ({ 'SVAROG_TABLES.OBJECT_ID': id, 'SVAROG_TABLES.TABLE_NAME': name, 'SVAROG_TABLES.LABEL_CODE': `l.${name}` })

const ACLS = [
  aclRow(1, 10, 'ANIMAL.READ'),
  aclRow(2, 10, 'ANIMAL.WRITE', 'WRITE'),
  aclRow(3, 10, 'Clinic', 'FULL', 'holding.type.clinic'),
  aclRow(4, 11, 'Clinic', 'FULL', 'clinic_checks'),
  aclRow(5, 0, 'card.lims_access', 'READ', 'card.lims_access'),
  aclRow(6, 12, 'LAB_SAMPLE.READ'),
  aclRow(7, 12, 'LAB_SAMPLE.READ'),
]

describe('readAcls', () => {
  it('tells table, scoped and custom codes apart', () => {
    expect(readAcls(ACLS).map(acl => acl.kind)).toEqual(['table', 'table', 'scoped', 'scoped', 'custom', 'table', 'table'])
  })

  it('keeps the scope key as the matrix does, and a level for each code', () => {
    const [read, , clinic, , custom] = readAcls(ACLS)
    expect(read).toMatchObject({ aclId: 1, resourceId: 10, configKey: null, level: 1, accessType: 'READ' })
    expect(clinic.configKey).toBe('holding.type.clinic')
    expect(custom).toMatchObject({ resourceId: 0, configKey: 'card.lims_access' })
  })

  it('reads nothing from an answer that is not a list', () => {
    expect(readAcls(undefined)).toEqual([])
  })
})

describe('catalogIndex', () => {
  const index = catalogIndex(readAcls(ACLS))

  it('finds a table code by table and label, first copy only', () => {
    expect(index.tableCode.get('10|ANIMAL.WRITE')).toBe(2)
    expect(index.tableCode.get('12|LAB_SAMPLE.READ')).toBe(6)
    expect(index.tableCode.has('10|Clinic')).toBe(false)
  })

  it('flags a label on two different permissions, not two copies of one', () => {
    expect(isAmbiguous(index, 'Clinic')).toBe(true)
    expect(isAmbiguous(index, 'LAB_SAMPLE.READ')).toBe(false)
    expect(isAmbiguous(index, 'ANIMAL.READ')).toBe(false)
    expect(isAmbiguous(index, 'NOT_THERE')).toBe(false)
  })
})

describe('holders', () => {
  const data = readAclData({
    aclRows: ACLS,
    holderRows: [sidRow(100, 1), sidRow(100, 5), sidRow(101, 5), sidRow(900, 5), sidRow(100, 6), sidRow(100, 7)],
    groups: [{ objectId: '101', groupName: 'VETS' }, { objectId: '100', groupName: 'ADMINS' }],
    tableRows: [tableRow(10, 'ANIMAL'), tableRow(1, 'SVAROG_USERS')],
  })

  it('gives each group its codes, every copy included', () => {
    expect(data.permissionsOf(100).map(acl => acl.aclId)).toEqual([1, 5, 6, 7])
    expect(data.permissionsOf('101')).toEqual([expect.objectContaining({ aclId: 5, resourceId: 0 })])
    expect(data.permissionsOf(555)).toEqual([])
  })

  it('names the groups that hold a code and counts other holders as direct', () => {
    expect(holdersOf(data, 5)).toEqual({ groups: [{ id: '100', name: 'ADMINS' }, { id: '101', name: 'VETS' }], direct: 1 })
    expect(holdersOf(data, 2)).toEqual({ groups: [], direct: 0 })
  })

  it('reads the tables, marking system ones', () => {
    expect(data.tables).toEqual([
      { id: 10, name: 'ANIMAL', labelCode: 'l.ANIMAL', system: false },
      { id: 1, name: 'SVAROG_USERS', labelCode: 'l.SVAROG_USERS', system: true },
    ])
    expect(readTables(null)).toEqual([])
  })

  it('skips held ids missing from the catalog', () => {
    const holders = readHolders([sidRow(1, 999), sidRow(1, 1)])
    expect(groupAcls(holders, data.index, 1).map(acl => acl.aclId)).toEqual([1])
  })
})

describe('checkNewCode', () => {
  const index = catalogIndex(readAcls(ACLS))
  const tables = [{ id: 10, name: 'ANIMAL' }, { id: 12, name: 'LAB_SAMPLE' }]
  const check = (name) => checkNewCode(name, { index, tables })

  it('accepts a new name in the usual shapes', () => {
    expect(check('card.new_module_access')).toEqual({ status: 'ok' })
    expect(check('EXPORT_PDF')).toEqual({ status: 'ok' })
    expect(check('lims.pre-approval')).toEqual({ status: 'ok' })
  })

  it('waits for a name', () => {
    expect(check('')).toEqual({ status: 'empty' })
    expect(check('   ')).toEqual({ status: 'empty' })
  })

  it('refuses spaces, line breaks and other characters', () => {
    expect(check('Add Program')).toMatchObject({ status: 'bad', reason: 'format' })
    expect(check(' card.x')).toMatchObject({ status: 'bad', reason: 'format' })
    expect(check('A\nB')).toMatchObject({ status: 'bad', reason: 'format' })
    expect(check('a/b')).toMatchObject({ status: 'bad', reason: 'format' })
  })

  it('refuses a name longer than the column', () => {
    expect(check('A'.repeat(101))).toMatchObject({ status: 'bad', reason: 'length', max: 100 })
    expect(check('A'.repeat(100)).status).toBe('ok')
  })

  it('refuses an existing code at any level, and one that differs only in case', () => {
    expect(check('card.lims_access')).toMatchObject({ status: 'bad', reason: 'exists' })
    expect(check('CARD.LIMS_ACCESS')).toMatchObject({ status: 'bad', reason: 'case', other: 'card.lims_access' })
  })

  it("refuses a table's own code name, which would be tied to no table", () => {
    expect(check('ANIMAL.FULL')).toMatchObject({ status: 'bad', reason: 'table', table: 'ANIMAL' })
    expect(check('lab_sample.modify')).toMatchObject({ status: 'bad', reason: 'table', table: 'LAB_SAMPLE' })
    expect(check('HOLDING.FULL').status).toBe('ok')
    expect(check('ANIMAL.APPROVE').status).toBe('ok')
  })
})
