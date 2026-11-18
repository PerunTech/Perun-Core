import { LEVELS, levelOf } from '../People/permissionMatrix'
import {
  TABLE_TYPE, diffMatrix, joinGroup, matrixOf, revokeCode, setGroupTableLevel, tablePermission
} from '../People/accessRoutes'
import { isAmbiguous, toAcl } from '../People/aclCatalog'
import { sameId } from '../People/people'

const key = (id) => String(id)

const isTableAcl = (acl) => Number(acl.resourceType) === TABLE_TYPE && !acl.configKey && key(acl.resourceId) !== '0'

// A group's level on each table: its highest code there that isn't scoped.
export const groupLevels = (acls) => {
  const levels = new Map()
  for (const acl of acls) {
    if (!isTableAcl(acl)) continue
    const id = key(acl.resourceId)
    levels.set(id, Math.max(levels.get(id) ?? 0, levelOf(acl.accessType)))
  }
  return levels
}

// A level can be set only through a code that exists and names that one permission.
export const levelCode = (index, table, level) => {
  if (level <= 0) return { ok: true, acl: null }
  const acl = tablePermission(index.tableCode, table, level)
  if (!acl) return { ok: false, reason: 'missing', code: `${table.name}.${LEVELS[level]}` }
  if (isAmbiguous(index, acl.labelCode)) return { ok: false, reason: 'ambiguous', code: acl.labelCode }
  return { ok: true, acl }
}

export const emptyEdits = () => ({ levels: new Map(), grant: [], revoke: [] })

/*
 * edits: { levels: Map tableId -> level, grant: [aclId], revoke: [labelCode] }, staged against the group's codes.
 * A table set to a level holds that level's code alone afterwards, and NONE takes every code on it. A revoke names a
 * code once per copy held, since each line drops one.
 */
export const planGroupEdit = ({ acls, tables, index, edits }) => {
  const levels = groupLevels(acls)
  const grant = []
  const revoke = []
  const changes = []
  for (const [tableId, to] of edits.levels) {
    const table = tables.find(each => sameId(each.id, tableId))
    const from = levels.get(key(tableId)) ?? 0
    const code = table ? levelCode(index, table, to) : { ok: false }
    if (!table || to === from || !code.ok) continue
    const held = acls.filter(acl => isTableAcl(acl) && sameId(acl.resourceId, tableId))
    const keep = (acl) => code.acl && acl.accessType === code.acl.accessType
    if (code.acl && !held.some(keep)) grant.push(code.acl.labelCode)
    held.filter(acl => !keep(acl)).forEach(acl => revoke.push(acl.labelCode))
    changes.push({ table, from, to, acl: code.acl })
  }
  const codeGrants = []
  for (const aclId of new Set(edits.grant.map(key))) {
    const entry = index.byId.get(aclId)
    if (!entry || acls.some(acl => sameId(acl.aclId, aclId)) || isAmbiguous(index, entry.labelCode)) continue
    grant.push(entry.labelCode)
    codeGrants.push(toAcl(entry))
  }
  const codeRevokes = []
  for (const labelCode of new Set(edits.revoke)) {
    const held = acls.filter(acl => acl.labelCode === labelCode)
    if (!held.length) continue
    held.forEach(() => revoke.push(labelCode))
    codeRevokes.push({ labelCode, acl: held[0] })
  }
  return { grant, revoke, changes, codeGrants, codeRevokes, empty: !grant.length && !revoke.length }
}

// Edits that no longer change anything, because the group already holds what they ask for, drop out.
export const pruneEdits = (edits, acls) => {
  const levels = groupLevels(acls)
  return {
    levels: new Map([...edits.levels].filter(([tableId, level]) => (levels.get(key(tableId)) ?? 0) !== level)),
    grant: edits.grant.filter(aclId => !acls.some(acl => sameId(acl.aclId, aclId))),
    revoke: edits.revoke.filter(labelCode => acls.some(acl => acl.labelCode === labelCode))
  }
}

export const replayGroupEdit = (state, group, plan) => {
  let next = state
  for (const change of plan.changes) next = setGroupTableLevel(next, group, change.table.id, change.acl)
  if (plan.codeGrants.length) next = joinGroup(next, group, plan.codeGrants)
  for (const { labelCode } of plan.codeRevokes) next = revokeCode(next, group, labelCode)
  return next
}

export const changeCount = (effect) => effect.tables.length + effect.gained.length + effect.lost.length

// `loaded` maps a member's id to their access state, or to null when it could not be read.
export const memberEffects = (members, loaded, group, plan) => members.map(person => {
  const id = key(person.id)
  if (!loaded.has(id)) return { person, pending: true, count: 0 }
  const state = loaded.get(id)
  if (!state) return { person, failed: true, count: 0 }
  if (state.bypass) return { person, bypass: true, count: 0 }
  const effect = diffMatrix(matrixOf(state), matrixOf(replayGroupEdit(state, group, plan)))
  return { person, effect, count: changeCount(effect) }
})

export const effectSummary = (effects) => ({
  total: effects.length,
  affected: effects.filter(each => each.count > 0).length,
  bypass: effects.filter(each => each.bypass).length,
  failed: effects.filter(each => each.failed).length,
  pending: effects.filter(each => each.pending).length
})
