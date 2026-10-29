// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { $, findSectionName, findWidget, replaceConfigParamsWithFieldVals } from '../../../frontend/elements/util/utils'

const flat = {
  'ui:order': ['NAME', 'REGION'],
  NAME: { 'ui:widget': 'text', 'ui:options': null },
  REGION: { 'ui:widget': 'DependencyDropdown' }
}
const sectioned = {
  general: { NAME: { 'ui:widget': 'text' }, NOTE: null },
  location: { MUNICIPALITY: { 'ui:widget': 'CustomSelectDropdown' }, REGION: { 'ui:widget': 'DependencyDropdown' } }
}

describe('findWidget', () => {
  it('finds the field that uses a widget, in a flat or a sectioned schema', () => {
    expect(findWidget(flat, 'ui:widget', 'DependencyDropdown')).toBe('REGION')
    expect(findWidget(sectioned, 'ui:widget', 'DependencyDropdown')).toBe('REGION')
    expect(findWidget(sectioned, 'ui:widget', 'CustomSelectDropdown')).toBe('MUNICIPALITY')
  })

  it('is null when no field uses it', () => {
    expect(findWidget(flat, 'ui:widget', 'CustomMultiSelectDropdown')).toBeNull()
    expect(findWidget({}, 'ui:widget', 'DependencyDropdown')).toBeNull()
  })
})

describe('findSectionName', () => {
  it('finds the section that holds a field', () => {
    expect(findSectionName(sectioned, 'REGION')).toBe('location')
    expect(findSectionName({ tabs: sectioned }, 'NAME')).toBe('general')
  })

  it('is null for a field in no section, or not there at all', () => {
    expect(findSectionName(flat, 'REGION')).toBeNull()
    expect(findSectionName(sectioned, 'PIN')).toBeNull()
  })
})

describe('replaceConfigParamsWithFieldVals', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('fills in the session and the values of the fields a path names', () => {
    document.body.innerHTML = '<input id="FARMER_ID" value="42"><input id="REGION" value="SK">'
    expect(replaceConfigParamsWithFieldVals('/ReactElements/getDependent/{token}/{FARMER_ID}/{REGION}', 's1'))
      .toBe('/ReactElements/getDependent/s1/42/SK')
  })

  it('leaves a path without placeholders as it is', () => {
    expect(replaceConfigParamsWithFieldVals('/ReactElements/getRegions', 's1')).toBe('/ReactElements/getRegions')
  })
})

describe('$', () => {
  it('is the element with the id, or null', () => {
    document.body.innerHTML = '<div id="exportBtns"></div>'
    expect($('exportBtns')).toBe(document.body.firstChild)
    expect($('missing')).toBeNull()
  })
})
