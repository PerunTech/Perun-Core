import { describe, expect, it } from 'vitest'
import md5 from 'md5'
import validator from '@rjsf/validator-ajv8'
import {
  addableGroups, fullName, initials, makeDefaultPlan, mergeGroups, newUserBody, sortGroups, sortPeople, toGroup, toPerson,
  userFormErrors,
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

describe('new user', () => {
  const schema = {
    type: 'object',
    required: ['USER_TYPE', 'USER_NAME', 'FIRST_NAME', 'LAST_NAME', 'E_MAIL', 'PASSWORD_HASH'],
    properties: {
      USER_TYPE: { type: 'string', enum: ['INTERNAL', 'EXTERNAL'] },
      USER_NAME: { type: 'string', maxLength: 10 },
      FIRST_NAME: { type: 'string' },
      LAST_NAME: { type: 'string' },
      E_MAIL: { type: 'string' },
      PASSWORD_HASH: { type: 'string' },
      CONFIRM_PASSWORD_HASH: { type: 'string' },
      PIN: { type: 'string' },
    },
  }
  const filled = { USER_TYPE: 'INTERNAL', USER_NAME: 'ANA', FIRST_NAME: 'Ana', LAST_NAME: 'K', E_MAIL: 'ana@example.com' }
  const missing = (formData) => userFormErrors(validator, schema, formData).map(error => error.params?.missingProperty || error.name)

  it('passes a filled user form without the password hashes', () => {
    expect(userFormErrors(validator, schema, filled)).toEqual([])
  })

  it('finds the required fields the password form does not fill', () => {
    expect(missing({ USER_TYPE: 'INTERNAL', FIRST_NAME: 'Ana' }).sort()).toEqual(['E_MAIL', 'LAST_NAME', 'USER_NAME'])
    expect(missing(undefined)).toHaveLength(5)
  })

  it('keeps the schema rules other than required', () => {
    expect(missing({ ...filled, USER_NAME: 'MUCH_TOO_LONG' })).toEqual(['maxLength'])
  })

  it('checks nothing before the schema has loaded', () => {
    expect(userFormErrors(validator, undefined, {})).toEqual([])
  })

  it('sends an empty PIN when it was left out, and the password hashes in upper case', () => {
    const body = newUserBody(filled, { userPassword: 'secret', confUserPassword: 'secret' })
    expect(body).toEqual({
      ...filled,
      PIN: '',
      PASSWORD_HASH: md5('secret').toUpperCase(),
      CONFIRM_PASSWORD_HASH: md5('secret').toUpperCase(),
    })
    expect(newUserBody({ ...filled, PIN: '123' }, { userPassword: 'a', confUserPassword: 'b' }).PIN).toBe('123')
  })

  it('leaves the form data as it was', () => {
    const formData = { ...filled }
    newUserBody(formData, { userPassword: 'a', confUserPassword: 'a' })
    expect(formData).toEqual(filled)
  })
})
