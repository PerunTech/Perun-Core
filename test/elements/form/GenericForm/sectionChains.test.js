// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { cleanUpEach, data, findAll, mountForm, pick, requested, select, serveCodelists, settle, until } from './harness.js'

const method = {
  type: 'object',
  properties: {
    'cp.scope': { type: 'object', properties: { REGION_CODE: { type: 'string', title: 'Region' }, MUNIC_CODE: { type: 'string', title: 'Municipality' } } },
    'cp.lab': {
      type: 'object',
      properties: {
        LAB_OBJ_ID: { type: 'string', title: 'Laboratory' },
        DEPARTMENT: { type: 'string', title: 'Department' },
        IS_ACCREDITED: { type: 'boolean', title: 'Accredited' },
        PURPOSE: { type: 'string', title: 'Purpose' }
      },
      allOf: [{ if: { properties: { PURPOSE: { const: 'ABORT' } }, required: ['PURPOSE'] }, then: { properties: { PACKAGE: { type: 'string', title: 'Package' } } } }]
    }
  }
}
const uiSchema = {
  'cp.scope': {
    REGION_CODE: { 'ui:widget': 'DependencyDropdown', codelistName: 'REGIONS', order: 0 },
    MUNIC_CODE: { 'ui:widget': 'hidden', dependentOnField: 'REGION_CODE', codelistName: 'MUNICIPALITIES', order: 1 }
  },
  'cp.lab': {
    LAB_OBJ_ID: { 'ui:widget': 'DependencyDropdown', codelistName: 'LABS', order: 0 },
    DEPARTMENT: { 'ui:widget': 'hidden', dependentOnField: 'LAB_OBJ_ID', codelistName: 'LAB_DEPT', order: 1 },
    IS_ACCREDITED: { 'ui:widget': 'DependentValueField', dependentOnField: 'DEPARTMENT', codelistName: 'ACCREDITED' },
    PACKAGE: { 'ui:widget': 'DependencyDropdown', codelistName: 'PACKAGE', order: 0 }
  }
}

describe('GenericForm DependencyDropdown in sections', { timeout: 15000 }, () => {
  cleanUpEach()
  let get

  beforeEach(() => {
    get = serveCodelists({
      roots: { REGIONS: ['R1', 'R2'], LABS: ['L1', 'L2'], PACKAGE: ['P1'] },
      levels: { MUNICIPALITIES: ['M1'], LAB_DEPT: ['D1'] },
      other: (url) => url.includes('getDependentFieldValue') && { data: { data: { value: true } } }
    })
  })

  const rootCodelists = () => requested(get).map((url) => url.match(/PARENT_CODE_VALUE\/([^/]+)\//)?.[1]).filter(Boolean)

  async function load (id, record, ...firstSelects) {
    mountForm({ id, method, uiSchemaConfigMethod: uiSchema, tableFormDataMethod: record })
    await until(() => firstSelects.forEach((s) => expect(select(s)).not.toBeNull()))
  }

  it('gives each root in each section its own field and codelist', async () => {
    await load('SECTION_ROOTS_FORM', {}, 'root_cp.scope_REGION_CODE', 'root_cp.lab_LAB_OBJ_ID')
    expect(new Set(rootCodelists())).toEqual(new Set(['REGIONS', 'LABS']))
  })

  it('draws a root that only an allOf branch of its section declares', async () => {
    await load('SECTION_ALLOF_FORM', { 'cp.lab': { PURPOSE: 'ABORT' } }, 'root_cp.lab_LAB_OBJ_ID', 'root_cp.lab_PACKAGE')
    expect(rootCodelists()).toContain('PACKAGE')
  })

  it('leaves the other chains alone when one root changes', async () => {
    await load('SECTION_CHAINS_FORM', {}, 'root_cp.scope_REGION_CODE', 'root_cp.lab_LAB_OBJ_ID')
    pick('root_cp.scope_REGION_CODE', 'R1')
    await until(() => expect(select('root_cp.scope_MUNIC_CODE')).not.toBeNull())
    pick('root_cp.lab_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull())

    pick('root_cp.scope_REGION_CODE', 'R2')
    await until(() => expect(data('SECTION_CHAINS_FORM')['cp.scope'].REGION_CODE).toBe('R2'))
    expect(select('root_cp.lab_LAB_OBJ_ID')?.value).toBe('L1')
    expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull()
    expect(data('SECTION_CHAINS_FORM')['cp.lab'].LAB_OBJ_ID).toBe('L1')
  })

  it('shows a saved record with two roots in one section, each with its own value and chain', async () => {
    const saved = { 'cp.lab': { LAB_OBJ_ID: 'L1', DEPARTMENT: 'D1', PURPOSE: 'ABORT', PACKAGE: 'P1' } }
    await load('SECTION_SAVED_FORM', saved, 'root_cp.lab_LAB_OBJ_ID', 'root_cp.lab_PACKAGE')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')?.value).toBe('D1'))
    await until(() => {
      expect(select('root_cp.lab_LAB_OBJ_ID').value).toBe('L1')
      expect(select('root_cp.lab_PACKAGE').value).toBe('P1')
    })
    expect(findAll('select[id="root_cp.lab_DEPARTMENT"]')).toHaveLength(1)
  })

  it('looks up a DependentValueField from the value in its own section', async () => {
    await load('SECTION_VALUE_FORM', {}, 'root_cp.lab_LAB_OBJ_ID')
    pick('root_cp.lab_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull())
    pick('root_cp.lab_DEPARTMENT', 'D1')
    await until(() => expect(requested(get).some((url) => url.includes('codelist-name/ACCREDITED/parent-code-value/D1/attribute/IS_ACCREDITED'))).toBe(true))
    await until(() => expect(data('SECTION_VALUE_FORM')['cp.lab'].IS_ACCREDITED).toBe(true))
  })

  it('keeps a root change when the DependentValueField below it clears itself', async () => {
    await load('SECTION_CLEAR_FORM', {}, 'root_cp.lab_LAB_OBJ_ID')
    pick('root_cp.lab_LAB_OBJ_ID', 'L1')
    await until(() => expect(select('root_cp.lab_DEPARTMENT')).not.toBeNull())
    pick('root_cp.lab_DEPARTMENT', 'D1')
    await until(() => expect(data('SECTION_CLEAR_FORM')['cp.lab'].IS_ACCREDITED).toBe(true))

    pick('root_cp.lab_LAB_OBJ_ID', 'L2')
    await until(() => expect(data('SECTION_CLEAR_FORM')['cp.lab'].IS_ACCREDITED).toBeUndefined())
    await settle()
    expect(data('SECTION_CLEAR_FORM')['cp.lab'].LAB_OBJ_ID).toBe('L2')
    expect(data('SECTION_CLEAR_FORM')['cp.lab'].DEPARTMENT).toBeUndefined()
  })
})
