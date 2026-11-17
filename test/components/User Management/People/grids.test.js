// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'
import {
  accessColumns, accessRows, fitHeight, grantRows, groupColumns, groupRows, otherColumns, otherRows, peopleColumns,
  peopleRows,
} from '../../../../frontend/components/User Management/People/grids'
import { readMatrix } from '../../../../frontend/components/User Management/People/permissionMatrix'

const t = (id, values) => (values ? `${id} ${JSON.stringify(values)}` : id)

const grant = (aclId, accessType, sourceGroups, configKey = null) =>
  ({ aclId, labelCode: `ACL_${aclId}`, accessType, configKey, sourceGroups })

const matrix = readMatrix({
  data: [
    {
      tableId: 1, tableName: 'ANIMAL', labelCode: 'naits.animal', effectiveAccess: 'WRITE', hasScopedPermissions: true,
      grants: [grant(1, 'READ', ['CLERKS']), grant(2, 'WRITE', ['VETS']), grant(4, 'WRITE', [])],
    },
    { tableId: 2, tableName: 'HOLDING', labelCode: '', effectiveAccess: 'NONE', hasScopedPermissions: false, grants: [] },
  ],
  otherPermissions: [grant(3, 'FULL', ['VETS'], 'REGION_1'), grant(8, 'READ', ['VETS'], 'ACL_8'), grant(7, 'EXECUTE', [])],
})

const cell = (columns, key, row) => {
  const { formatter } = columns.find(c => c.key === key)
  document.body.innerHTML = renderToStaticMarkup(
    React.createElement(IntlProvider, { locale: 'en', messages: {}, onError: () => {} }, React.createElement(formatter, { row })))
  return document.body
}

describe('grid columns', () => {
  it('names columns from perun.grid_labels, as the grid does when it translates them', () => {
    expect(peopleColumns(t).map(c => [c.key, c.name])).toContainEqual(['PEOPLE.USER_NAME', 'perun.grid_labels.people.user_name'])
  })

  it('makes type, status, level and membership code list columns', () => {
    const status = peopleColumns(t).find(c => c.key === 'PEOPLE.STATUS')
    expect(status.formatterType).toBe('DropDownFormatter')
    expect(status.formatterOptions).toEqual([
      { value: 'VALID', text: 'perun.people.active' }, { value: 'INVALID', text: 'perun.people.disabled' },
    ])
    expect(accessColumns(t).find(c => c.key === 'PEOPLE_ACCESS.LEVEL').formatterOptions[3]).toEqual({ value: 3, text: 'EXECUTE' })
    expect(groupColumns(t).find(c => c.key === 'PEOPLE_GROUPS.ACTIONS')).toMatchObject({ sortable: false, filterable: false })
  })
})

describe('grid rows', () => {
  it('keys every row by a .PKID, which the grid reads its row ids from', () => {
    const [row] = peopleRows([{ id: 9, userName: 'EP', firstName: 'Elena', lastName: '', email: '', pin: '', type: 'INTERNAL', status: 'VALID' }])
    expect(row).toMatchObject({ 'PEOPLE.PKID': 9, 'PEOPLE.NAME': 'Elena', 'PEOPLE.STATUS': 'VALID' })
  })

  it('lists what sets a table level, as text to filter by and chips to show', () => {
    const [animal, holding] = accessRows(matrix.rows, { bypass: false, label: row => row.labelCode || row.name, t })
    expect(animal).toMatchObject({
      'PEOPLE_ACCESS.PKID': 1, 'PEOPLE_ACCESS.TABLE': 'naits.animal (ANIMAL)', 'PEOPLE_ACCESS.LEVEL': 2,
      'PEOPLE_ACCESS.THROUGH': 'VETS, perun.people.direct, perun.people.scoped',
    })
    expect(animal['PEOPLE_ACCESS.SOURCES'].map(s => s.kind)).toEqual(['group', 'direct', 'scoped'])
    expect(holding['PEOPLE_ACCESS.THROUGH']).toBe('')
    expect(holding['PEOPLE_ACCESS.TABLE']).toBe('HOLDING')
  })

  it('shows a table code beside the label only where the table has a label', () => {
    const [animal, holding] = accessRows(matrix.rows, { bypass: false, label: row => row.labelCode || row.name, t })
    const columns = accessColumns(t)
    expect(cell(columns, 'PEOPLE_ACCESS.TABLE', animal).querySelector('.people-aside').textContent).toBe('ANIMAL')
    const plain = cell(columns, 'PEOPLE_ACCESS.TABLE', holding)
    expect(plain.textContent).toBe('HOLDING')
    expect(plain.querySelector('.people-aside')).toBeNull()
  })

  it('shows two chips and a count of the rest, with all of them in the title', () => {
    const sources = ['A', 'B', 'C', 'D'].map(text => ({ kind: 'group', text }))
    const root = cell(accessColumns(t), 'PEOPLE_ACCESS.THROUGH', { 'PEOPLE_ACCESS.SOURCES': sources, 'PEOPLE_ACCESS.LEVEL': 1 })
    expect([...root.querySelectorAll('.people-chip')].map(chip => chip.textContent)).toEqual(['A', 'B', '+2'])
    expect(root.querySelector('.people-chips').getAttribute('title')).toBe('A, B, C, D')
  })

  it('names ADMINISTRATORS as the source of every level under the bypass', () => {
    const rows = accessRows(matrix.rows, { bypass: true, label: row => row.name, t })
    expect(rows.map(r => r['PEOPLE_ACCESS.THROUGH'])).toEqual(['ADMINISTRATORS', 'ADMINISTRATORS'])
  })

  it('marks the grants that set the level', () => {
    const rows = grantRows(matrix.rows[0], t)
    expect(rows.map(r => r['PEOPLE_GRANTS.PKID'])).toEqual([2, 4, 1])
    expect(rows.map(r => r.additionalClassName)).toEqual(['people-grant-sets', 'people-grant-sets', undefined])
    expect(rows[2]['PEOPLE_GRANTS.EFFECT']).toBe('perun.people.effect_lower {"key":null}')
  })

  it('puts the scoped and custom grants in one list', () => {
    const rows = otherRows(matrix, t)
    expect(rows.map(r => [r['PEOPLE_GRANTS.KIND'], r['PEOPLE_GRANTS.CODE'], r['PEOPLE_GRANTS.THROUGH']])).toEqual([
      ['perun.people.other_scoped', 'ACL_3 (REGION_1)', 'VETS'],
      ['perun.people.other_scoped', 'ACL_8', 'VETS'],
      ['perun.people.other_custom', 'ACL_7', 'perun.people.direct'],
    ])
    expect(cell(otherColumns(t), 'PEOPLE_GRANTS.CODE', rows[0]).querySelector('.people-aside').textContent).toBe('REGION_1')
    expect(cell(otherColumns(t), 'PEOPLE_GRANTS.CODE', rows[1]).querySelector('.people-aside')).toBeNull()
  })

  it('reads the default group as a membership code', () => {
    expect(groupRows([{ id: 1, name: 'VETS', isDefault: true }, { id: 2, name: 'LAB', isDefault: false }])
      .map(r => r['PEOPLE_GROUPS.MEMBERSHIP'])).toEqual(['DEFAULT', 'ADDITIONAL'])
  })

  it('sizes a short grid to its rows, up to a limit', () => {
    expect(fitHeight(0)).toBe(fitHeight(1))
    expect(fitHeight(3)).toBe(50 + 3 * 35 + 18)
    expect(fitHeight(40)).toBe(fitHeight(8))
  })
})
