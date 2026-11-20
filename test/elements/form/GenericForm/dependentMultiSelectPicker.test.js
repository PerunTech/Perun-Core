// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanUpEach, data, find, findAll, mountForm, pick, requested, select, serveCodelists, settle, type, until } from './harness.js'

const method = {
  type: 'object',
  properties: {
    scope: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          REGION_CODE: { type: 'string', title: 'Region' },
          VILLAGE_CODE: { type: 'string', title: 'Village' },
          HOLDING_OBJ_IDS: { type: 'array', title: 'Holdings', uniqueItems: true, items: { type: 'integer' } }
        }
      }
    }
  }
}
const picker = {
  'ui:widget': 'DependentMultiSelectPicker',
  'ui:placeholder': 'Pick first',
  dependentOnField: 'VILLAGE_CODE',
  fieldListUrl: '/Ws/fields/SID/H',
  dataUrl: '/Ws/picker/SID/{VILLAGE_CODE}',
  valueField: 'H.OBJECT_ID',
  selectAllByDefault: true
}
const uiSchema = {
  scope: {
    items: {
      REGION_CODE: { 'ui:widget': 'DependencyDropdown', codelistName: 'REGIONS', order: 0 },
      VILLAGE_CODE: { 'ui:widget': 'hidden', dependentOnField: 'REGION_CODE', codelistName: 'VILLAGES', order: 1 },
      HOLDING_OBJ_IDS: picker
    }
  }
}
const columns = [{ key: 'H.PIC', name: 'PIC', filterable: true, sortable: true, resizable: true, width: 150 }]
const rowsFor = (ids, pic = (id) => `P-${id}`) => ids.map((id) => ({ 'H.PKID': id * 10, 'H.OBJECT_ID': id, 'H.PIC': pic(id) }))
const holdings = {
  V1: rowsFor([11, 12, 13]),
  V2: rowsFor([21, 22]),
  V3: [],
  V4: rowsFor([41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52], (id) => (id % 2 ? `ODD-${id}` : `EVEN-${id}`)),
  V5: rowsFor([51])
}

describe('GenericForm DependentMultiSelectPicker', { timeout: 15000 }, () => {
  cleanUpEach()
  let get
  // A village's rows wait for the promise held under it
  let held

  beforeEach(() => {
    held = {}
    // happy-dom lays nothing out, and the grid's virtualizer draws only the rows that fit its viewport
    vi.spyOn(window.HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
      return this.classList.contains('perun-grid-viewport') ? 1000 : 0
    })
    get = serveCodelists({
      roots: { REGIONS: ['R1', 'R2'] },
      levels: { VILLAGES: { R1: ['V1', 'V2', 'V3', 'V4'], R2: ['V5'] } },
      other: (url) => {
        if (url.includes('/Ws/fields/')) return { data: columns }
        if (url.includes('/Ws/picker/')) {
          const village = url.split('/').pop()
          const answer = { data: holdings[village] || [] }
          return held[village] ? held[village].then(() => answer) : answer
        }
      }
    })
  })

  const row = (formId, i) => data(formId)?.scope?.[i]
  const picks = (formId, i) => row(formId, i)?.HOLDING_OBJ_IDS
  const pickerOf = (i) => find(`[id="root_scope_${i}_HOLDING_OBJ_IDS"]`)
  const gridRows = (el) => Array.from(el?.querySelectorAll('.perun-grid-row') ?? [])
  const shownIn = (el) => gridRows(el).map((r) => r.querySelector('.perun-grid-cell:not(.perun-grid-cell--select)').textContent)
  const boxesIn = (el) => gridRows(el).map((r) => r.querySelector('.perun-grid-cell--select input'))
  const shown = (i) => shownIn(pickerOf(i))
  const boxes = (i) => boxesIn(pickerOf(i))
  const allBox = (i) => pickerOf(i).querySelector('[data-part="select-all"] input')
  const ticked = (i) => boxes(i).map((box) => box.checked)
  const pickerCalls = () => requested(get).filter((url) => url.includes('/Ws/picker/'))

  async function load (id, record = {}, ui = uiSchema) {
    mountForm({ id, method, uiSchemaConfigMethod: ui, tableFormDataMethod: record })
    await until(() => expect(find('[id="root_scope"] .array-item-add button')).not.toBeNull())
  }

  async function addRow (i) {
    const adds = findAll('[id="root_scope"] .array-item-add button')
    adds[adds.length - 1].click()
    await until(() => expect(select(`root_scope_${i}_REGION_CODE`)).not.toBeNull())
  }

  async function pickVillage (formId, i, region, village) {
    if (select(`root_scope_${i}_REGION_CODE`).value !== region) {
      pick(`root_scope_${i}_REGION_CODE`, region)
      await until(() => expect(select(`root_scope_${i}_VILLAGE_CODE`)).not.toBeNull())
    }
    pick(`root_scope_${i}_VILLAGE_CODE`, village)
    await until(() => expect(row(formId, i)?.VILLAGE_CODE).toBe(village))
  }

  it('waits on a new row, without a request and without dropping the row', async () => {
    await load('PICKER_NEW_ROW_FORM')
    await addRow(0)
    await settle()
    expect(pickerOf(0).textContent).toBe('Pick first')
    expect(pickerCalls()).toEqual([])
    expect(data('PICKER_NEW_ROW_FORM').scope).toHaveLength(1)
  })

  it('loads the rows for the row\'s value into a grid with the field list\'s columns, and ticks all of them', async () => {
    await load('PICKER_LOAD_FORM')
    await addRow(0)
    await pickVillage('PICKER_LOAD_FORM', 0, 'R1', 'V1')
    await until(() => expect(picks('PICKER_LOAD_FORM', 0)).toEqual([11, 12, 13]))
    await until(() => expect(ticked(0)).toEqual([true, true, true]))
    expect(pickerCalls()).toEqual(['http://backend/Ws/picker/SID/V1'])
    expect(requested(get)).toContain('http://backend/Ws/fields/SID/H')
    expect(shown(0)).toEqual(['P-11', 'P-12', 'P-13'])
    expect(pickerOf(0).querySelector('[role="columnheader"]:not([data-part="select-all"])').textContent).toContain('PIC')
    expect(allBox(0).checked).toBe(true)
    expect(row('PICKER_LOAD_FORM', 0).REGION_CODE).toBe('R1')
  })

  it('keeps an untick, and ticks everything again for another village', async () => {
    await load('PICKER_CHANGE_FORM')
    await addRow(0)
    await pickVillage('PICKER_CHANGE_FORM', 0, 'R1', 'V1')
    await until(() => expect(ticked(0)).toEqual([true, true, true]))

    boxes(0)[1].click()
    await until(() => expect(picks('PICKER_CHANGE_FORM', 0)).toEqual([11, 13]))
    expect(ticked(0)).toEqual([true, false, true])

    await pickVillage('PICKER_CHANGE_FORM', 0, 'R1', 'V2')
    await until(() => expect(picks('PICKER_CHANGE_FORM', 0)).toEqual([21, 22]))
    await until(() => expect(shown(0)).toEqual(['P-21', 'P-22']))
    await until(() => expect(ticked(0)).toEqual([true, true]))
    expect(row('PICKER_CHANGE_FORM', 0).VILLAGE_CODE).toBe('V2')
  })

  it('clears when the field it depends on is cleared, and keeps the root change that cleared it', async () => {
    await load('PICKER_CLEAR_FORM')
    await addRow(0)
    await pickVillage('PICKER_CLEAR_FORM', 0, 'R1', 'V1')
    await until(() => expect(ticked(0)).toEqual([true, true, true]))

    pick('root_scope_0_REGION_CODE', 'R2')
    await until(() => expect(picks('PICKER_CLEAR_FORM', 0)).toEqual([]))
    await settle()
    expect(row('PICKER_CLEAR_FORM', 0).REGION_CODE).toBe('R2')
    expect(row('PICKER_CLEAR_FORM', 0).VILLAGE_CODE).toBeUndefined()
    expect(gridRows(pickerOf(0))).toEqual([])
    expect(pickerOf(0).textContent).toBe('Pick first')
  })

  it('drops the answer for a village that is no longer picked', async () => {
    let release
    held.V1 = new Promise((resolve) => { release = resolve })
    await load('PICKER_STALE_FORM')
    await addRow(0)
    await pickVillage('PICKER_STALE_FORM', 0, 'R1', 'V1')
    await pickVillage('PICKER_STALE_FORM', 0, 'R1', 'V2')
    await until(() => expect(picks('PICKER_STALE_FORM', 0)).toEqual([21, 22]))
    await until(() => expect(shown(0)).toEqual(['P-21', 'P-22']))

    release()
    await settle()
    expect(picks('PICKER_STALE_FORM', 0)).toEqual([21, 22])
    expect(shown(0)).toEqual(['P-21', 'P-22'])
  })

  it('gives each row its own grid and selection', async () => {
    await load('PICKER_ROWS_FORM')
    await addRow(0)
    await pickVillage('PICKER_ROWS_FORM', 0, 'R1', 'V1')
    await until(() => expect(ticked(0)).toEqual([true, true, true]))
    boxes(0)[0].click()
    await until(() => expect(picks('PICKER_ROWS_FORM', 0)).toEqual([12, 13]))

    await addRow(1)
    await pickVillage('PICKER_ROWS_FORM', 1, 'R1', 'V2')
    await until(() => expect(picks('PICKER_ROWS_FORM', 1)).toEqual([21, 22]))
    await until(() => expect(ticked(1)).toEqual([true, true]))
    expect(picks('PICKER_ROWS_FORM', 0)).toEqual([12, 13])
    expect(shown(0)).toEqual(['P-11', 'P-12', 'P-13'])
    expect(ticked(0)).toEqual([false, true, true])
  })

  it('unticks and ticks only the rows the grid\'s filter shows, and Enter in the filter doesn\'t submit', async () => {
    await load('PICKER_FILTER_FORM')
    await addRow(0)
    await pickVillage('PICKER_FILTER_FORM', 0, 'R1', 'V4')
    await until(() => expect(boxes(0)).toHaveLength(12))
    await until(() => expect(picks('PICKER_FILTER_FORM', 0)).toHaveLength(12))

    pickerOf(0).querySelector('[data-action="toggle-filters"]').click()
    await until(() => expect(pickerOf(0).querySelector('[data-part="filters"] input[type="text"]')).not.toBeNull())
    const filter = pickerOf(0).querySelector('[data-part="filters"] input[type="text"]')
    const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    filter.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)

    type(filter, 'odd')
    await until(() => expect(shown(0)).toHaveLength(6))
    allBox(0).click()
    await until(() => expect(picks('PICKER_FILTER_FORM', 0)).toEqual([42, 44, 46, 48, 50, 52]))
    allBox(0).click()
    await until(() => expect(picks('PICKER_FILTER_FORM', 0)).toHaveLength(12))
    expect(picks('PICKER_FILTER_FORM', 0)[0]).toBe(41)
  })

  it('shows the grid\'s empty view for a village with nothing to pick', async () => {
    await load('PICKER_EMPTY_FORM')
    await addRow(0)
    await pickVillage('PICKER_EMPTY_FORM', 0, 'R1', 'V3')
    await until(() => expect(pickerOf(0).querySelector('[data-part="empty"]')).not.toBeNull())
    expect(picks('PICKER_EMPTY_FORM', 0) ?? []).toEqual([])
  })

  it('keeps what a saved row already holds', async () => {
    await load('PICKER_SAVED_FORM', { scope: [{ REGION_CODE: 'R1', VILLAGE_CODE: 'V1', HOLDING_OBJ_IDS: [12] }] })
    await until(() => expect(shown(0)).toEqual(['P-11', 'P-12', 'P-13']))
    await until(() => expect(ticked(0)).toEqual([false, true, false]))
    await settle()
    expect(picks('PICKER_SAVED_FORM', 0)).toEqual([12])
  })

  it('shows only the picked rows, with nothing to tick, when read only', async () => {
    const readonly = { scope: { items: { ...uiSchema.scope.items, HOLDING_OBJ_IDS: { ...picker, 'ui:readonly': true } } } }
    await load('PICKER_READONLY_FORM', { scope: [{ REGION_CODE: 'R1', VILLAGE_CODE: 'V1', HOLDING_OBJ_IDS: [12, 13] }] }, readonly)
    await until(() => expect(shown(0)).toEqual(['P-12', 'P-13']))
    expect(pickerOf(0).querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(picks('PICKER_READONLY_FORM', 0)).toEqual([12, 13])
  })

  it('works in a section, and keeps the root change that clears it', async () => {
    const sectioned = { type: 'object', properties: { 'cp.scope': method.properties.scope.items } }
    const ui = { 'cp.scope': uiSchema.scope.items }
    const scope = () => data('PICKER_SECTION_FORM')?.['cp.scope']
    const box = () => find('[id="root_cp.scope_HOLDING_OBJ_IDS"]')
    mountForm({ id: 'PICKER_SECTION_FORM', method: sectioned, uiSchemaConfigMethod: ui, tableFormDataMethod: {} })
    await until(() => expect(select('root_cp.scope_REGION_CODE')).not.toBeNull())
    pick('root_cp.scope_REGION_CODE', 'R1')
    await until(() => expect(select('root_cp.scope_VILLAGE_CODE')).not.toBeNull())
    pick('root_cp.scope_VILLAGE_CODE', 'V2')
    await until(() => expect(scope()?.HOLDING_OBJ_IDS).toEqual([21, 22]))
    await until(() => expect(boxesIn(box())).toHaveLength(2))

    pick('root_cp.scope_REGION_CODE', 'R2')
    await until(() => expect(scope()?.HOLDING_OBJ_IDS).toEqual([]))
    await settle()
    expect(scope().REGION_CODE).toBe('R2')
    expect(scope().VILLAGE_CODE).toBeUndefined()
  })
})
