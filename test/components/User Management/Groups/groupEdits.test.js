import { describe, expect, it } from 'vitest'
import {
  effectSummary, emptyEdits, groupLevels, levelCode, memberEffects, planGroupEdit, pruneEdits, replayGroupEdit,
} from '../../../../frontend/components/User Management/Groups/groupEdits'
import { catalogIndex } from '../../../../frontend/components/User Management/People/aclCatalog'
import { accessState, matrixOf } from '../../../../frontend/components/User Management/People/accessRoutes'

const LEVELS = ['NONE', 'READ', 'WRITE', 'EXECUTE', 'MODIFY', 'FULL']

const entry = (aclId, resourceId, labelCode, accessType, configKey = null) => ({
  aclId, labelCode, accessType, level: LEVELS.indexOf(accessType), resourceId, resourceType: 50, configKey,
  kind: String(resourceId) === '0' ? 'custom' : configKey ? 'scoped' : 'table',
})
const tableCodes = (tableId, name, firstId) => LEVELS.slice(1).map((level, i) => entry(firstId + i, tableId, `${name}.${level}`, level))

const ANIMAL = { id: 10, name: 'ANIMAL' }
const HOLDING = { id: 11, name: 'HOLDING' }
const LAB = { id: 12, name: 'LAB_SAMPLE' }
const TABLES = [ANIMAL, HOLDING, LAB]
const CATALOG = [
  ...tableCodes(10, 'ANIMAL', 100),
  ...tableCodes(11, 'HOLDING', 110),
  ...tableCodes(12, 'LAB_SAMPLE', 120),
  entry(125, 12, 'LAB_SAMPLE.READ', 'READ'),
  entry(130, 0, 'card.lims_access', 'READ', 'card.lims_access'),
  entry(131, 10, 'Clinic', 'FULL', 'holding.type.clinic'),
  entry(132, 11, 'Clinic', 'FULL', 'clinic_checks'),
  entry(133, 11, 'HOLDING.APPROVED', 'FULL', 'HOLDING.APPROVED'),
]
const index = catalogIndex(CATALOG)
const byId = (id) => CATALOG.find(acl => acl.aclId === id)
const held = (...ids) => ids.map(byId)

const edits = (levels = {}, grant = [], revoke = []) => ({ levels: new Map(Object.entries(levels)), grant, revoke })
const plan = (acls, change) => planGroupEdit({ acls, tables: TABLES, index, edits: change })

describe('groupLevels', () => {
  it('takes the highest unscoped table code per table', () => {
    const levels = groupLevels(held(100, 102, 131, 130, 110))
    expect(Object.fromEntries(levels)).toEqual({ 10: 3, 11: 1 })
  })
})

describe('levelCode', () => {
  it('finds the code for a level, none for NONE', () => {
    expect(levelCode(index, ANIMAL, 2)).toMatchObject({ ok: true, acl: { aclId: 101, labelCode: 'ANIMAL.WRITE' } })
    expect(levelCode(index, ANIMAL, 0)).toEqual({ ok: true, acl: null })
  })

  it('refuses a level whose code is missing', () => {
    expect(levelCode(index, { id: 99, name: 'GHOST' }, 1)).toEqual({ ok: false, reason: 'missing', code: 'GHOST.READ' })
  })

  it('refuses a level whose code also names another permission', () => {
    const shared = catalogIndex([...CATALOG, entry(140, 0, 'ANIMAL.FULL', 'FULL', 'ANIMAL.FULL')])
    expect(levelCode(shared, ANIMAL, 5)).toEqual({ ok: false, reason: 'ambiguous', code: 'ANIMAL.FULL' })
  })
})

describe('planGroupEdit', () => {
  it('raises a table: grants the new code, revokes the lower one', () => {
    const result = plan(held(100), edits({ 10: 2 }))
    expect(result.grant).toEqual(['ANIMAL.WRITE'])
    expect(result.revoke).toEqual(['ANIMAL.READ'])
    expect(result.changes).toEqual([expect.objectContaining({ table: ANIMAL, from: 1, to: 2 })])
  })

  it('lowers a table and keeps a code it already holds at the target', () => {
    const result = plan(held(100, 104), edits({ 10: 1 }))
    expect(result.grant).toEqual([])
    expect(result.revoke).toEqual(['ANIMAL.FULL'])
  })

  it('takes every code on a table set to NONE, scoped ones aside', () => {
    const result = plan(held(100, 101, 131), edits({ 10: 0 }))
    expect(result.grant).toEqual([])
    expect(result.revoke).toEqual(['ANIMAL.READ', 'ANIMAL.WRITE'])
    expect(result.changes[0].acl).toBeNull()
  })

  it('names a code once per copy held', () => {
    const result = plan(held(120, 125), edits({ 12: 2 }))
    expect(result.grant).toEqual(['LAB_SAMPLE.WRITE'])
    expect(result.revoke).toEqual(['LAB_SAMPLE.READ', 'LAB_SAMPLE.READ'])
  })

  it('skips a level the group already has, and tables or levels it cannot set', () => {
    const shared = catalogIndex([...CATALOG, entry(140, 0, 'ANIMAL.FULL', 'FULL', 'ANIMAL.FULL')])
    const result = planGroupEdit({ acls: held(100), tables: TABLES, index: shared, edits: edits({ 10: 5, 11: 0, 99: 1 }) })
    expect(result.changes).toEqual([])
    expect(result.empty).toBe(true)
  })

  it('grants a custom code once, unless held or ambiguous', () => {
    const result = plan(held(100), edits({}, [130, '130', 100, 131, 999]))
    expect(result.grant).toEqual(['card.lims_access'])
    expect(result.codeGrants).toEqual([expect.objectContaining({ aclId: 130, resourceId: 0 })])
  })

  it('revokes a code once per copy, and ignores one the group lacks', () => {
    const result = plan(held(133, 130), edits({}, [], ['HOLDING.APPROVED', 'HOLDING.APPROVED', 'nope']))
    expect(result.revoke).toEqual(['HOLDING.APPROVED'])
    expect(result.codeRevokes).toEqual([{ labelCode: 'HOLDING.APPROVED', acl: expect.objectContaining({ aclId: 133 }) }])
  })

  it('puts table and code changes in one grant and one revoke list', () => {
    const result = plan(held(100, 133), edits({ 10: 4, 11: 1 }, [130], ['HOLDING.APPROVED']))
    expect(result.grant).toEqual(['ANIMAL.MODIFY', 'HOLDING.READ', 'card.lims_access'])
    expect(result.revoke).toEqual(['ANIMAL.READ', 'HOLDING.APPROVED'])
    expect(result.empty).toBe(false)
  })
})

describe('pruneEdits', () => {
  it('drops what the group holds already after a save', () => {
    const pruned = pruneEdits(edits({ 10: 2, 11: 1 }, [130, 133], ['HOLDING.APPROVED', 'card.lims_access']), held(101, 130))
    expect(Object.fromEntries(pruned.levels)).toEqual({ 11: 1 })
    expect(pruned.grant).toEqual([133])
    expect(pruned.revoke).toEqual(['card.lims_access'])
    expect(emptyEdits().levels.size).toBe(0)
  })
})

// A member's access as the matrix endpoint answers it, built from their grants.
const member = (grants, tables = TABLES, bypass = false) => ({
  administratorBypass: bypass,
  data: tables.map(table => ({
    tableId: table.id,
    tableName: table.name,
    grants: grants.filter(([acl]) => acl.resourceId === table.id).map(([acl, groups]) => ({ ...acl, sourceGroups: groups })),
  })),
  otherPermissions: grants.filter(([acl]) => acl.resourceId === 0 || acl.configKey).map(([acl, groups]) => ({ ...acl, sourceGroups: groups })),
})

describe('member preview', () => {
  const raise = plan(held(100), edits({ 10: 2 }, [130]))

  it('shows what a member gains through the group', () => {
    const state = accessState(member([[byId(100), ['VETS']]]))
    const after = matrixOf(replayGroupEdit(state, 'VETS', raise))
    expect(after.rows.find(row => row.id === 10).level).toBe(2)
    const [effect] = memberEffects([{ id: 7 }], new Map([['7', state]]), 'VETS', raise)
    expect(effect.count).toBe(2)
    expect(effect.effect.tables.map(change => [change.from, change.to])).toEqual([[1, 2]])
    expect(effect.effect.gained.map(grant => grant.aclId)).toEqual([130])
  })

  it('changes nothing for a member another group already covers', () => {
    const lower = plan(held(102), edits({ 10: 1 }))
    const state = accessState(member([[byId(102), ['VETS', 'WMS']]]))
    const [effect] = memberEffects([{ id: 7 }], new Map([['7', state]]), 'VETS', lower)
    expect(effect.count).toBe(0)
  })

  it('lowers a member the group alone gave the level to', () => {
    const lower = plan(held(102), edits({ 10: 0 }))
    const state = accessState(member([[byId(102), ['VETS']], [byId(100), ['WMS']]]))
    const [effect] = memberEffects([{ id: 7 }], new Map([['7', state]]), 'VETS', lower)
    expect(effect.effect.tables.map(change => [change.from, change.to])).toEqual([[3, 1]])
  })

  it('takes a revoked code from a member who holds it only through the group', () => {
    const drop = plan(held(130), edits({}, [], ['card.lims_access']))
    const state = accessState(member([[byId(130), ['VETS']]]))
    const [effect] = memberEffects([{ id: 7 }], new Map([['7', state]]), 'VETS', drop)
    expect(effect.effect.lost.map(grant => grant.aclId)).toEqual([130])
  })

  it('sorts members into affected, administrators, failed and still loading', () => {
    const vets = accessState(member([[byId(100), ['VETS']]]))
    const admin = accessState(member([], TABLES, true))
    const people = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const effects = memberEffects(people, new Map([['1', vets], ['2', admin], ['3', null]]), 'VETS', raise)
    expect(effects.map(each => Object.keys(each).filter(k => k !== 'person' && k !== 'effect'))).toEqual([
      ['count'], ['bypass', 'count'], ['failed', 'count'], ['pending', 'count'],
    ])
    expect(effectSummary(effects)).toEqual({ total: 4, affected: 1, bypass: 1, failed: 1, pending: 1 })
  })
})
