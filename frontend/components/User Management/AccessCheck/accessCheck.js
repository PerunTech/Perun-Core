import { diffMatrix, joinGroup, matrixOf } from '../People/accessRoutes'
import { sameId } from '../People/people'
import { changeCount } from '../Groups/groupEdits'

export const checkTable = (matrix, tableId, need) => {
  const row = matrix.rows.find(each => sameId(each.id, tableId))
  if (!row) return null
  if (matrix.bypass) return { verdict: 'bypass', row, level: row.level, groups: [], direct: false, scoped: [] }
  return {
    verdict: row.level >= need ? 'yes' : 'no',
    row,
    level: row.level,
    groups: row.groups,
    direct: row.direct,
    scoped: [...new Set(row.grants.filter(grant => grant.configKey).map(grant => grant.configKey))]
  }
}

export const checkCode = (matrix, aclId) => {
  if (matrix.bypass) return { verdict: 'bypass', groups: [], direct: false }
  const held = [...matrix.scoped, ...matrix.custom].filter(grant => sameId(grant.aclId, aclId))
  return {
    verdict: held.length ? 'yes' : 'no',
    groups: [...new Set(held.flatMap(grant => grant.groups))].sort(),
    direct: held.some(grant => grant.direct)
  }
}

// Groups that hold the code and the person is not in yet, the fewest other changes for them first.
export const codeRoutes = ({ state, aclId, groups, candidates }) => {
  if (state.bypass) return []
  const before = matrixOf(state)
  return candidates
    .filter(candidate => !groups.some(own => sameId(own.id, candidate.id)) &&
      candidate.permissions.some(acl => sameId(acl.aclId, aclId)))
    .map(candidate => {
      const full = diffMatrix(before, matrixOf(joinGroup(state, candidate.name, candidate.permissions)))
      const effect = { ...full, gained: full.gained.filter(grant => !sameId(grant.aclId, aclId)) }
      return {
        key: `join:${candidate.id}`,
        group: { id: candidate.id, name: candidate.name },
        effect,
        side: changeCount(effect),
        steps: [{ op: 'add', groupId: candidate.id }]
      }
    })
    .sort((a, b) => a.side - b.side || a.group.name.localeCompare(b.group.name))
}
