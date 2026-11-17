const userField = (row, field) => row?.[`SVAROG_USERS.${field}`]
const groupField = (row, field) => row?.[`SVAROG_USER_GROUPS.${field}`]

export const toPerson = (row) => ({
  id: userField(row, 'OBJECT_ID'),
  objectType: userField(row, 'OBJECT_TYPE'),
  userName: userField(row, 'USER_NAME') || '',
  firstName: userField(row, 'FIRST_NAME') || '',
  lastName: userField(row, 'LAST_NAME') || '',
  email: userField(row, 'E_MAIL') || '',
  pin: userField(row, 'PIN') || '',
  type: userField(row, 'USER_TYPE') || '',
  status: userField(row, 'STATUS') || ''
})

export const fullName = (person) => [person.firstName, person.lastName].filter(Boolean).join(' ') || person.userName

export const initials = (person) => {
  const names = [person.firstName, person.lastName].filter(Boolean)
  const letters = names.length ? names.map(name => name[0]) : [person.userName[0]]
  return letters.join('').slice(0, 2).toUpperCase()
}

export const isActive = (person) => person.status === 'VALID'
export const isExternal = (person) => person.type === 'EXTERNAL'
export const sameId = (a, b) => a !== undefined && a !== null && String(a) === String(b)

export const sortPeople = (people) => [...people].sort((a, b) =>
  fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }) || a.userName.localeCompare(b.userName))

export const toGroup = (row) => ({
  id: groupField(row, 'OBJECT_ID'),
  name: groupField(row, 'GROUP_NAME') || '',
  labelCode: groupField(row, 'LABEL_CODE') || '',
  isDefault: row?.DEFAULTGROUP === true
})

// A person can be linked to their default group as an additional group too, which lists it twice.
export const mergeGroups = (groups) => {
  const byId = new Map()
  for (const group of groups) {
    const key = String(group.id)
    const seen = byId.get(key)
    byId.set(key, seen ? { ...seen, isDefault: seen.isDefault || group.isDefault } : group)
  }
  return [...byId.values()]
}

export const sortGroups = (groups) => [...groups].sort((a, b) =>
  Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))

export const addableGroups = (allGroups, linked) => allGroups
  .filter(group => !linked.some(own => sameId(own.id, group.objectId)))
  .map(group => ({ value: String(group.objectId), label: group.groupName }))
  .sort((a, b) => a.label.localeCompare(b.label))

// Svarog refuses a second default, and a group cannot be both default and additional, so the old default goes
// first and comes back as an additional group last.
export const makeDefaultPlan = (groups, groupId) => {
  const target = groups.find(group => sameId(group.id, groupId))
  if (!target || target.isDefault) return []
  const current = groups.find(group => group.isDefault)
  return [
    ...(current ? [{ op: 'remove', groupId: current.id }] : []),
    { op: 'remove', groupId: target.id },
    { op: 'default', groupId: target.id },
    ...(current ? [{ op: 'add', groupId: current.id }] : [])
  ]
}
