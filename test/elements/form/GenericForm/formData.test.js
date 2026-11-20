// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { Wrapper, cleanUpEach, data, field, find, formInstance, mountForm, setData, type, until } from './harness.js'

const schema = {
  type: 'object',
  properties: {
    NOTE: { type: 'string' },
    ITEMS: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ID: { type: 'integer' },
          NAME: { type: 'string' },
          QTY: { type: 'integer' }
        }
      },
      default: []
    }
  }
}

const items = (formId) => data(formId)?.ITEMS

async function renderForm (id) {
  mountForm({ id, method: schema, uiSchemaConfigMethod: {}, tableFormDataMethod: {}, inputWrapper: Wrapper })
  // Loaded: the Add button is drawn and the schema's defaults are published
  await until(() => {
    expect(find('.array-item-add button')).not.toBeNull()
    expect(items(id)).toEqual([])
  })
}

async function addItem (formId) {
  find('.array-item-add button').click()
  await until(() => {
    expect(field('root_ITEMS_0_NAME')).not.toBeNull()
    expect(items(formId)).toHaveLength(1)
  })
}

describe('GenericForm form data', { timeout: 15000 }, () => {
  cleanUpEach()

  it('shows a value a wrapper writes into an array item of formTableData in place', async () => {
    await renderForm('IN_PLACE_FORM')
    await addItem('IN_PLACE_FORM')

    // What the RecordSelectWrapper copies do with a picked row
    const formData = data('IN_PLACE_FORM')
    formData.ITEMS[0] = { ...formData.ITEMS[0], ID: 4711, NAME: 'Amoxicillin' }
    setData('IN_PLACE_FORM', formData)
    formInstance().setState({ formTableData: formData })
    formInstance().onInputChange(formData)

    await until(() => {
      expect(field('root_ITEMS_0_NAME').value).toBe('Amoxicillin')
      expect(field('root_ITEMS_0_ID').value).toBe('4711')
    })

    type(field('root_ITEMS_0_QTY'), '5')

    await until(() => expect(items('IN_PLACE_FORM')).toEqual([{ ID: 4711, NAME: 'Amoxicillin', QTY: 5 }]))
    expect(field('root_ITEMS_0_NAME').value).toBe('Amoxicillin')
  })

  it('takes the form data itself as well as an rjsf change event', async () => {
    await renderForm('PLAIN_DATA_FORM')
    await addItem('PLAIN_DATA_FORM')

    formInstance().onInputChange({ ...data('PLAIN_DATA_FORM'), NOTE: 'picked', ITEMS: [{ ID: 815, NAME: 'Oxytetracycline' }] })

    await until(() => {
      expect(field('root_NOTE').value).toBe('picked')
      expect(field('root_ITEMS_0_NAME').value).toBe('Oxytetracycline')
    })
  })

  // A form remounted under a new id draws before that id's formTableData reaches its props
  it('draws a GPSCoordinate field while the form has no formTableData', async () => {
    mountForm({
      id: 'GPS_FORM',
      method: { type: 'object', properties: { GPS_NORTH: { type: 'string' }, GPS_EAST: { type: 'string' } } },
      uiSchemaConfigMethod: { GPS_NORTH: { 'ui:widget': 'GPSCoordinate' }, GPS_EAST: { 'ui:widget': 'GPSCoordinate' } },
      tableFormDataMethod: undefined
    })
    await until(() => {
      expect(field('root_GPS_NORTH')?.value).toBe("00°00'00''")
      expect(field('root_GPS_EAST')?.value).toBe("00°00'00''")
    })
  })
})
