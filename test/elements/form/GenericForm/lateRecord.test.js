// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  Wrapper, arrive, cleanUpEach, data, field, findAll, formInstance, h, labChain, labRequest, mount, mountForm, options,
  pick, requested, select, serveCodelists, settle, type, until
} from './harness.js'
import DependencyDropdown from '../../../../frontend/elements/base/dropdown/DependencyDropdown'

const section = 'holding.location.info'
const method = {
  type: 'object',
  properties: {
    'holding.basic': { type: 'object', properties: { ADDRESS: { type: 'string', title: 'Address' } } },
    [section]: {
      type: 'object',
      properties: {
        REGION_CODE: { type: 'string', title: 'Region' },
        MUNIC_CODE: { type: 'string', title: 'Municipality' },
        COMMUN_CODE: { type: 'string', title: 'Community' },
        VILLAGE_CODE: { type: 'string', title: 'Village' }
      }
    }
  }
}
const uiSchema = {
  [section]: {
    REGION_CODE: { 'ui:widget': 'DependencyDropdown', codelistName: 'REGIONS', order: 0 },
    MUNIC_CODE: { 'ui:widget': 'hidden', dependentOnField: 'REGION_CODE', codelistName: 'MUNICIPALITIES', order: 1 },
    COMMUN_CODE: { 'ui:widget': 'hidden', dependentOnField: 'MUNIC_CODE', codelistName: 'COMMUNITIES', order: 2 },
    VILLAGE_CODE: { 'ui:widget': 'hidden', dependentOnField: 'COMMUN_CODE', codelistName: 'VILLAGES', order: 3 }
  }
}
const record = { 'holding.basic': { ADDRESS: 'Street 9' }, [section]: { REGION_CODE: 'R1', MUNIC_CODE: 'M1', COMMUN_CODE: 'C1', VILLAGE_CODE: 'V1' } }
const [REGION, MUNIC, COMMUN, VILLAGE] = ['REGION_CODE', 'MUNIC_CODE', 'COMMUN_CODE', 'VILLAGE_CODE'].map((key) => `root_${section}_${key}`)
const ADDRESS = 'root_holding.basic_ADDRESS'

// The record lands after the schema: a form remounted under a new id, or a slow getTableFormData
describe('GenericForm DependencyDropdown with the record arriving after the form', { timeout: 15000 }, () => {
  cleanUpEach()
  let get

  beforeEach(() => {
    get = serveCodelists({
      roots: { REGIONS: ['R1', 'R2'], LABS: ['L1', 'L2'] },
      levels: {
        MUNICIPALITIES: { R1: ['M1', 'M2'], R2: ['M3'] },
        COMMUNITIES: { M1: ['C1'], M2: ['C2'], M3: ['C3'] },
        VILLAGES: { C1: ['V1'], C3: ['V3'] },
        LAB_DEPT: { L1: ['D1'], L2: ['D2'] }
      },
      other: (url) => (url.includes('getTableUISchema') && { data: uiSchema }) || (url.includes('getTableJSONSchema') && { data: method })
    })
  })

  const regionFetches = () => requested(get).filter((url) => url.includes('PARENT_CODE_VALUE/REGIONS/')).length

  async function showRecordLate (id) {
    mountForm({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: undefined, inputWrapper: Wrapper })
    await until(() => expect(options(REGION)).toEqual(['R1', 'R2']))
    expect(select(REGION).value).toBe('')
    arrive(id, record)
    await until(() => {
      expect(select(REGION).value).toBe('R1')
      expect(select(MUNIC)?.value).toBe('M1')
      expect(select(COMMUN)?.value).toBe('C1')
      expect(select(VILLAGE)?.value).toBe('V1')
    })
  }

  it('shows the chain of a record that arrives after the form has drawn', async () => {
    await showRecordLate('LATE_RECORD_FORM')
    expect(findAll('select')).toHaveLength(4)
    expect(data('LATE_RECORD_FORM')[section]).toEqual(record[section])
  })

  it('keeps a pick made after the record arrived when the form data comes back as props', async () => {
    await showRecordLate('LATE_PICK_FORM')
    const fetchesBefore = regionFetches()

    pick(REGION, 'R2')
    await until(() => expect(options(MUNIC)).toEqual(['M3']))
    expect(select(MUNIC).value).toBe('')
    expect(select(COMMUN)).toBeNull()
    expect(select(VILLAGE)).toBeNull()
    expect(data('LATE_PICK_FORM')[section]).toMatchObject({ REGION_CODE: 'R2', MUNIC_CODE: undefined, COMMUN_CODE: undefined, VILLAGE_CODE: undefined })

    pick(MUNIC, 'M3')
    await until(() => expect(options(COMMUN)).toEqual(['C3']))

    // An edit elsewhere, then a render of every field, which hands the chain the form data again
    type(field(ADDRESS), 'Street 10')
    await until(() => expect(data('LATE_PICK_FORM')['holding.basic'].ADDRESS).toBe('Street 10'))
    formInstance().setState({ disabled: true })
    await until(() => expect(field(ADDRESS).disabled).toBe(true))
    formInstance().setState({ disabled: false })
    await until(() => expect(field(ADDRESS).disabled).toBe(false))
    await settle()

    expect(select(REGION).value).toBe('R2')
    expect(select(MUNIC).value).toBe('M3')
    expect(options(COMMUN)).toEqual(['C3'])
    expect(select(VILLAGE)).toBeNull()
    expect(data('LATE_PICK_FORM')[section]).toMatchObject({ REGION_CODE: 'R2', MUNIC_CODE: 'M3', COMMUN_CODE: undefined })
    expect(regionFetches()).toBe(fetchesBefore)
  })

  it('changes the root of a chain walked to its end without drawing it again', async () => {
    mountForm({ id: 'WALKED_CHAIN_FORM', method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: {}, inputWrapper: Wrapper })
    await until(() => expect(options(REGION)).toEqual(['R1', 'R2']))
    const regionOptions = select(REGION).options.length
    pick(REGION, 'R1')
    await until(() => expect(options(MUNIC)).toEqual(['M1', 'M2']))
    pick(MUNIC, 'M1')
    await until(() => expect(options(COMMUN)).toEqual(['C1']))
    pick(COMMUN, 'C1')
    await until(() => expect(options(VILLAGE)).toEqual(['V1']))
    pick(VILLAGE, 'V1')
    await until(() => expect(data('WALKED_CHAIN_FORM')[section].VILLAGE_CODE).toBe('V1'))
    // rjsf's change event for another field hands GenericForm a copy of every section
    type(field(ADDRESS), 'Street 10')
    await until(() => expect(data('WALKED_CHAIN_FORM')['holding.basic'].ADDRESS).toBe('Street 10'))
    const fetchesBefore = regionFetches()

    pick(REGION, 'R2')
    await until(() => expect(options(MUNIC)).toEqual(['M3']))
    await settle()

    expect(regionFetches()).toBe(fetchesBefore)
    expect(requested(get).filter((url) => url.includes('MUNICIPALITIES/parent-code-value/R1'))).toHaveLength(1)
    expect(select(REGION).value).toBe('R2')
    expect(select(REGION).options.length).toBe(regionOptions)
    expect(data('WALKED_CHAIN_FORM')[section]).toMatchObject({ REGION_CODE: 'R2', MUNIC_CODE: undefined, COMMUN_CODE: undefined, VILLAGE_CODE: undefined })
  })

  it('shows a record that arrives after the form has drawn an empty array row', async () => {
    const atLeastOneRow = { type: 'object', properties: { LAB_REQUEST: { type: 'array', items: labRequest, minItems: 1 } } }
    mountForm({ id: 'LATE_ARRAY_FORM', method: atLeastOneRow, uiSchemaConfigMethod: { LAB_REQUEST: { items: labChain } }, tableFormDataMethod: undefined })
    await until(() => expect(options('root_LAB_REQUEST_0_LAB_OBJ_ID')).toEqual(['L1', 'L2']))

    arrive('LATE_ARRAY_FORM', { LAB_REQUEST: [{ LAB_OBJ_ID: 'L2', DEPARTMENT: 'D2' }] })
    await until(() => {
      expect(select('root_LAB_REQUEST_0_LAB_OBJ_ID').value).toBe('L2')
      expect(select('root_LAB_REQUEST_0_DEPARTMENT')?.value).toBe('D2')
    })
  })

  it('draws an external chain, which loads its own schemas, from the form data its parent passes later', async () => {
    const dropdown = (props) => h(DependencyDropdown, { tableName: 'HOLDING', ...props })
    const redraw = mount(dropdown({}))
    await until(() => expect(options(REGION)).toEqual(['R1', 'R2']))

    redraw(dropdown({ formData: structuredClone(record) }))
    await until(() => {
      expect(select(REGION).value).toBe('R1')
      expect(select(VILLAGE)?.value).toBe('V1')
    })

    pick(REGION, 'R2')
    await until(() => expect(options(MUNIC)).toEqual(['M3']))
    expect(select(COMMUN)).toBeNull()
    redraw(dropdown({ formData: structuredClone(record) }))
    await settle()
    expect(select(REGION).value).toBe('R2')
    expect(options(MUNIC)).toEqual(['M3'])
  })
})
