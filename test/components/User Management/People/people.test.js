import { describe, expect, it } from 'vitest'
import {
  addableGroups, fullName, initials, makeDefaultPlan, mergeGroups, sortGroups, sortPeople, toGroup, toPerson,
} from '../../../../frontend/components/User Management/People/people'

const userRow = (id, userName, first, last, extra = {}) => ({
  'SVAROG_USERS.OBJECT_ID': id,
  'SVAROG_USERS.USER_NAME': userName,
  'SVAROG_USERS.FIRST_NAME': first,
  'SVAROG_USERS.LAST_NAME': last,
  'SVAROG_USERS.USER_TYPE': 'INTERNAL',
  'SVAROG_USERS.STATUS': 'VALID',
  ...extra,
})

const people = [
  userRow(1, 'EPETROVSKA', 'Elena', 'Petrovska', { 'SVAROG_USERS.E_MAIL': 'elena@example.org', 'SVAROG_USERS.PIN': '1203' }),
  userRow(2, 'MARKO', 'Marko', 'Ilievski', { 'SVAROG_USERS.STATUS': 'INVALID' }),
  userRow(3, 'PORTAL1', null, null, { 'SVAROG_USERS.USER_TYPE': 'EXTERNAL' }),
].map(toPerson)

describe('people', () => {
  it('reads a searchUsers row', () => {
    expect(people[0]).toMatchObject({ id: 1, userName: 'EPETROVSKA', email: 'elena@example.org', pin: '1203', type: 'INTERNAL' })
    expect(people[2].firstName).toBe('')
  })

  it('names a person, falling back to the username', () => {
    expect(fullName(people[0])).toBe('Elena Petrovska')
    expect(fullName(people[2])).toBe('PORTAL1')
    expect(initials(people[0])).toBe('EP')
    expect(initials(people[2])).toBe('P')
  })

  it('sorts by name', () => {
    expect(sortPeople(people).map(p => p.id)).toEqual([1, 2, 3])
  })
})

const groupRow = (id, name, isDefault) => ({
  'SVAROG_USER_GROUPS.OBJECT_ID': id,
  'SVAROG_USER_GROUPS.GROUP_NAME': name,
  ...(isDefault ? { DEFAULTGROUP: true } : {}),
})

const groups = [groupRow(20, 'VETS'), groupRow(10, 'INSPECTORS', true), groupRow(30, 'LAB')].map(toGroup)

describe('groups', () => {
  it('puts the default group first, then by name', () => {
    expect(sortGroups(groups).map(g => g.name)).toEqual(['INSPECTORS', 'LAB', 'VETS'])
  })

  it('lists a group linked both as default and as additional once, as the default', () => {
    const twice = [groupRow(10, 'INSPECTORS', true), groupRow(20, 'VETS'), groupRow('10', 'INSPECTORS')].map(toGroup)
    expect(mergeGroups(twice)).toEqual([
      { id: 10, name: 'INSPECTORS', labelCode: '', isDefault: true },
      { id: 20, name: 'VETS', labelCode: '', isDefault: false },
    ])
    expect(mergeGroups([groupRow(20, 'VETS'), groupRow(20, 'VETS', true)].map(toGroup))[0].isDefault).toBe(true)
  })

  it('offers only groups the person is not in', () => {
    const all = [{ groupName: 'VETS', objectId: '20' }, { groupName: 'ADMINS', objectId: '1' }, { groupName: 'CLERKS', objectId: '5' }]
    expect(addableGroups(all, groups)).toEqual([{ value: '1', label: 'ADMINS' }, { value: '5', label: 'CLERKS' }])
  })

  it('swaps the default in the order svarog accepts', () => {
    expect(makeDefaultPlan(groups, 20)).toEqual([
      { op: 'remove', groupId: 10 },
      { op: 'remove', groupId: 20 },
      { op: 'default', groupId: 20 },
      { op: 'add', groupId: 10 },
    ])
  })

  it('makes a default without an old one to restore', () => {
    const noDefault = groups.map(g => ({ ...g, isDefault: false }))
    expect(makeDefaultPlan(noDefault, '30')).toEqual([{ op: 'remove', groupId: 30 }, { op: 'default', groupId: 30 }])
  })

  it('does nothing for the current default or an unknown group', () => {
    expect(makeDefaultPlan(groups, 10)).toEqual([])
    expect(makeDefaultPlan(groups, 99)).toEqual([])
  })
})
