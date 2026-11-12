import React from 'react';
import axios from 'axios';
import { connect } from 'react-redux';
import { store } from '../../../model'
import { svConfig } from '../../../config';
import { Dropdown, ComponentManager, alertUserResponse } from '../..';
import { Loading } from '../../../components/ComponentsIndex';
import { isValidArray, isValidObject, schemaAtPath, uiSchemaAtPath } from '../../../functions/utils';
import FieldHelpButton from '../../fieldHelp/FieldHelpButton';

const getIn = (obj, keys) => keys.reduce((node, key) => node?.[key], obj)

const setIn = (obj, [key, ...rest], value) => {
  const copy = Array.isArray(obj) ? [...obj] : (obj == null && typeof key === 'number') ? [] : { ...obj }
  copy[key] = rest.length ? setIn(copy[key], rest, value) : value
  return copy
}

const sameChain = (a, b) => Object.keys({ ...a, ...b }).every(key => (a[key] ?? '') === (b[key] ?? ''))

const right = {
  'display': 'inline-table'
}

const additionalStyle = {
  'display': 'inline-table',
  'marginLeft': '0.5rem'
}

const down = {
  'display': 'block'
}

class DependentElements extends React.Component {
  constructor(props) {
    super(props)
    const initialState = {
      loading: false,
      initialDropdown: null,
      dynamicDropdowns: [],
      spread: this.props.spread || 'right'
    }
    this.state = initialState
    // Bumped by a redraw or a pick, so a draw still in flight stops
    this.draw = 0
    this.style = right
    this.additionalStyle = additionalStyle
    if (this.props.spread === 'down') {
      this.style = down
      this.additionalStyle = down
    }
  }

  isArraySchema = () => {
    return !!this.props.arrayScope || this.props.formConfig?.type === 'array'
  }

  // Where the array sits in the form data, and where a row keeps this chain's fields; both empty for a root array
  arrayScope = () => this.props.arrayScope || { arrayPath: [], itemPath: [] }

  rowPath = (index) => {
    const { arrayPath, itemPath } = this.arrayScope()
    return [...arrayPath, index, ...itemPath]
  }

  itemsUiSchema = () => uiSchemaAtPath(this.props.formSchema, this.rowPath(0)) || {}

  itemsJsonSchema = () => schemaAtPath(this.props.formConfig, this.rowPath(0))

  rowPrefix = (index) => `${['root', ...this.rowPath(index)].join('_')}_`

  // The row an element ID belongs to; null for an element of another array
  rowIndex = (elementId) => {
    const head = `${['root', ...this.arrayScope().arrayPath].join('_')}_`
    const index = elementId?.startsWith(head) ? elementId.slice(head.length).match(/^(\d+)_/)?.[1] : undefined
    return index !== undefined && elementId.startsWith(this.rowPrefix(Number(index))) ? Number(index) : null
  }

  rowField = (elementId) => elementId.slice(this.rowPrefix(this.rowIndex(elementId)).length)

  holdsRows = (tableData) => Array.isArray(getIn(tableData, this.arrayScope().arrayPath))

  withRowValue = (tableData, index, field, value) => setIn(tableData, [...this.rowPath(index), field], value)

  // Falls back to allOf's conditional branches.
  getArrayItemTitle = (coreType) => {
    const items = this.itemsJsonSchema()
    if (!items) return undefined
    if (items.properties?.[coreType]?.title) return items.properties[coreType].title
    for (const clause of (items.allOf || [])) {
      if (clause.then?.properties?.[coreType]?.title) return clause.then.properties[coreType].title
    }
    return undefined
  }

  // Falls back to allOf's conditional branches.
  getSchemaProperty = (formConfig, coreType) => {
    if (formConfig?.properties?.[coreType]) return formConfig.properties[coreType]
    for (const clause of (formConfig?.allOf || [])) {
      if (clause.then?.properties?.[coreType]) return clause.then.properties[coreType]
    }
    return undefined
  }

  // Returns true if `key` transitively depends on `fieldCode` via dependentOnField links.
  isInChain = (key, fieldCode, itemsSchema) => {
    let current = key
    const visited = new Set()
    while (current && !visited.has(current)) {
      visited.add(current)
      const depOn = itemsSchema[current]?.dependentOnField
      if (depOn === fieldCode) return true
      current = depOn
    }
    return false
  }

  chainValues = (formData) => {
    const { fieldCode, sectionName, formSchema } = this.props
    let fields, values
    if (this.isArraySchema()) {
      fields = this.itemsUiSchema()
      values = getIn(formData, this.rowPath(this.rowIndex(this.props.elementId)))
    } else if (sectionName) {
      fields = formSchema?.[sectionName] || {}
      values = formData?.[sectionName]
    } else {
      fields = formSchema || {}
      values = formData
    }
    const chain = {}
    Object.keys(fields).forEach(key => {
      if (key === fieldCode || (fields[key]?.['ui:widget'] === 'hidden' && this.isInChain(key, fieldCode, fields))) {
        chain[key] = values?.[key] == null ? '' : String(values[key])
      }
    })
    chain[fieldCode] = values?.[fieldCode] == null ? '' : String(values[fieldCode])
    return chain
  }

  componentDidMount() {
    const { formConfig, sectionName } = this.props
    const formData = this.props.formData
    this.shown = this.chainValues(formData)
    this.lastIncoming = this.shown

    if (this.isArraySchema()) {
      const rowData = getIn(formData, this.rowPath(this.rowIndex(this.props.elementId)))
      if (rowData && Object.keys(rowData).length > 0) {
        this.generateExisting()
      } else {
        this.fetchInitialCodelist()
      }
      return
    }

    const formDataCopy = Object.assign({}, formData)
    if (formDataCopy && formDataCopy.constructor === Object && Object.keys(formDataCopy).length > 0) {
      if (sectionName) {
        // The section can be missing while other sections have data, e.g. a schema default
        // in another section on a new record, so check the section's own fields
        const subEls = Object.keys(formDataCopy[sectionName] || {})
        if (subEls.length > 0) {
          this.generateExisting()
        } else {
          this.fetchInitialCodelist()
        }
      } else { //no section
        const formFields = Object.keys(formConfig.properties)
        const finalFormData = Object.assign({}, formDataCopy)
        formFields.forEach(field => {
          if (!finalFormData[field]) {
            finalFormData[field] = ''
          }
        })
        const subEls = Object.keys(finalFormData)
        if (subEls.length > 0) {
          this.generateExisting()
        } else {
          this.fetchInitialCodelist()
        }
      }
    } else { //generate empty input intial
      this.fetchInitialCodelist()
    }
  }

  // The record can arrive after mount, when the schema came first, and array rows can move. The chain's
  // own picks come back as formData too; they match what it shows, so they don't redraw it.
  componentDidUpdate(prevProps) {
    // The chain's own writes edit formData in place, and rjsf may not redraw it with newer data, so the
    // same formData can hold values older than the chain's picks
    if (prevProps.formData === this.props.formData && prevProps.elementId === this.props.elementId) return
    const incoming = this.chainValues(this.props.formData)
    const changed = !sameChain(incoming, this.lastIncoming)
    this.lastIncoming = incoming
    if (prevProps.elementId !== this.props.elementId) {
      // rjsf moves a row before GenericForm's onChange has the rows in their new order, and doesn't
      // redraw it again once it has them, so read them a tick later
      const draw = ++this.draw
      setTimeout(() => {
        if (draw !== this.draw) return
        const formData = this.currentFormData()
        this.redraw(this.chainValues(formData), formData)
      }, 0)
    } else if (changed && !sameChain(incoming, this.shown)) {
      this.redraw(incoming)
    }
  }

  currentFormData = () => {
    const tableData = ComponentManager.getStateForComponent(this.props.formId)?.formTableData
    return this.holdsRows(tableData) ? tableData : this.props.formInstance?.state.formTableData
  }

  redraw = (values, formData) => {
    this.draw += 1
    this.shown = values
    this.setState({ dynamicDropdowns: [] })
    if (Object.values(values).some(value => value !== '')) {
      this.generateExisting(formData)
    } else {
      this.fetchInitialCodelist()
    }
  }

  fetchInitialCodelist = (selectedVal) => {
    const { elementId, triggerAutoDependentDropdownOnChange, disableInitialDependentDropdown } = this.props
    let verbPath = svConfig.triglavRestVerbs.GET_TABLE_WITH_FILTER
    if (!verbPath) {
      console.warn('Missing GET TABLE WS in configuration')
      return
    }
    let codelistName
    if (this.isArraySchema()) {
      codelistName = this.itemsUiSchema()[this.props.fieldCode]?.codelistName
    } else if (this.props.sectionName) {
      codelistName = this.props.formSchema[this.props.sectionName][this.props.fieldCode].codelistName
    } else {
      codelistName = this.props.formSchema[this.props.fieldCode].codelistName
    }
    verbPath = verbPath.replace('%session', this.props.svSession)
    verbPath = verbPath.replace('%objectName', 'SVAROG_CODES')
    verbPath = verbPath.replace('%searchBy', 'PARENT_CODE_VALUE')
    verbPath = verbPath.replace('%searchForValue', codelistName)
    verbPath = verbPath.replace('%rowlimit', '0')
    const restUrl = svConfig.restSvcBaseUrl + verbPath
    const draw = this.draw
    this.setState({ loading: true })
    axios.get(restUrl).then((response) => {
      this.setState({ loading: false })
      if (draw === this.draw && response?.data) {
        this.generateInitialDropdown(response.data, elementId, selectedVal, triggerAutoDependentDropdownOnChange, disableInitialDependentDropdown)
      }
    }).catch((error) => {
      console.error(error)
      this.setState({ loading: false })
    })
  }

  componentWillUnmount = () => {
    this.draw += 1
    if (!this.isArraySchema()) return

    const { fieldCode } = this.props
    const itemsSchema = this.itemsUiSchema()
    const arrayIndex = this.rowIndex(this.props.elementId)

    // Remove DOM-injected chain dropdowns (not the React-managed root).
    Array.from(document.getElementsByClassName('dependent-dropdown')).forEach(el => {
      if (this.rowIndex(el.id) !== arrayIndex) return
      const elCoreType = this.findCoreType(el.id)[1]
      if (!this.isInChain(elCoreType, fieldCode, itemsSchema)) return
      el.parentNode?.parentNode?.removeChild(el.parentNode)
    })

    // rjsf unmounts this component before GenericForm's onChange fires, so
    // ComponentManager is stale here. Defer until after onChange has updated it.
    const rowsBefore = this.rowCount()
    const row = document.getElementById(this.rowPrefix(arrayIndex).slice(0, -1))
    setTimeout(() => {
      // The row went with the chain (removed, or remounted for a record with another number of rows):
      // the values at its index now belong to another row
      if (!document.getElementById(this.props.formId) || this.rowCount() !== rowsBefore || row?.isConnected === false) return
      this.clearFormData(fieldCode)
      Object.keys(itemsSchema).forEach(key => {
        if (this.isInChain(key, fieldCode, itemsSchema)) {
          this.clearFormData(key)
        }
      })
    }, 0)
  }

  rowCount = () => getIn(this.currentFormData(), this.arrayScope().arrayPath)?.length

  findCoreType = (stringId) => {
    if (this.isArraySchema()) {
      return [this.props.sectionName, this.rowField(stringId)]
    }
    let string = `root_`
    if (this.props.sectionName) {
      string = `root_${this.props.sectionName}_`
    }
    const regex = new RegExp(string, 'g')
    const coreType = stringId.replace(regex, '')
    if (this.props.sectionName) {
      return [this.props.sectionName, coreType]
    } else {
      return ['', coreType]
    }
  }

  generateInitialDropdown =(dbDataArray, elementId, selectedVal, triggerAutoOnChange, isDisabled) => {
    const { selectedInitialValue } = this.props
    let options = []
    if (!selectedVal) {
      options.push({
        id: 'default',
        key: 'default',
        name: 'default',
        value: '',
        selected: true,
        disabled: true,
        hidden: true
      })
    }

    const coreType = this.findCoreType(elementId)[1]
    let labelText
    let requiredFieldsArr
    if (this.isArraySchema()) {
      labelText = this.getArrayItemTitle(coreType)
      requiredFieldsArr = this.itemsJsonSchema()?.required
    } else if (!this.props.sectionName) {
      labelText = this.getSchemaProperty(this.props.formConfig, coreType)?.title
      requiredFieldsArr = this.props.formConfig.required
    } else {
      labelText = this.getSchemaProperty(this.props.formConfig.properties[this.props.sectionName], coreType)?.title
      requiredFieldsArr = this.props.formConfig.properties[this.props.sectionName].required
    }
    let requiredAttr = false
    if (isValidArray(requiredFieldsArr, 1) && requiredFieldsArr.includes(coreType)) {
      requiredAttr = true
    }

    for (let i = 0; i < dbDataArray.length; i++) {
      let selected = false
      if (selectedVal && selectedVal === dbDataArray[i]['SVAROG_CODES.CODE_VALUE']) {
        selected = true
      } else if (triggerAutoOnChange && selectedInitialValue) {
        selected = true
      }
      options.push({
        id: dbDataArray[i]['SVAROG_CODES.OBJECT_ID'],
        key: dbDataArray[i]['SVAROG_CODES.OBJECT_ID'],
        name: dbDataArray[i]['SVAROG_CODES.CODE_VALUE'],
        value: dbDataArray[i]['SVAROG_CODES.CODE_VALUE'],
        text: dbDataArray[i]['SVAROG_CODES.LABEL_CODE'],
        selected: selected
      })
    }

    const dropdown = <Dropdown
      className='dependent-dropdown'
      id={elementId}
      key={elementId + '_depddl'}
      labelText={this.props.hideInternalLabel ? undefined : labelText}
      style={this.props.hideInternalLabel ? undefined : this.style}
      defaultValue='default'
      name='initialDropdown'
      onChange={() => this.onSelect(elementId, true)}
      options={options}
      required={requiredAttr}
      disabled={isDisabled}
    />
    const newElement = this.props.hideInternalLabel ? (
      <div key={elementId + '_wrap'} style={this.style}>
        <div className='admin-console-field-label-row'>
          <label className='control-label'>
            {labelText}
            {requiredAttr && <span className='required'>{'*'}</span>}
          </label>
          {this.props.helpCode && <FieldHelpButton labelCode={this.props.helpCode} />}
        </div>
        {dropdown}
      </div>
    ) : dropdown
    this.setState({ initialDropdown: newElement })
    if (triggerAutoOnChange) {
      this.onChange(elementId, true)
    }
  }

  generateExisting = async (formData = this.props.formData) => {
    const { formSchema, sectionName, elementId } = this.props;
    const draw = this.draw
    let formObjectsArray = [];

    if (this.isArraySchema()) {
      const arrayIndex = this.rowIndex(elementId)
      const itemsSchema = this.itemsUiSchema()
      const rowData = getIn(formData, this.rowPath(arrayIndex)) || {}
      const fieldCode = this.props.fieldCode

      Object.keys(itemsSchema).forEach(key => {
        if (key === fieldCode) {
          this.fetchInitialCodelist(rowData[key])
        } else if (itemsSchema[key]?.['ui:widget'] === 'hidden' && this.isInChain(key, fieldCode, itemsSchema)) {
          // Only the hidden chain dropdowns: a field can declare dependentOnField for its own reasons
          // (DependentValueField) without being in the chain.
          formObjectsArray.push({
            ...itemsSchema[key],
            value: rowData[key],
            parentVal: rowData[itemsSchema[key]['dependentOnField']],
            coreType: key
          })
        }
      })

      const sortedArr = formObjectsArray.sort((a, b) => a.order - b.order)
      for (const el of sortedArr) {
        // A parent without a value ends the chain.
        if (el.parentVal === undefined || el.parentVal === null || el.parentVal === '') break
        await this.generateDropdownInOrder(el.codelistName, arrayIndex, el.value, el.parentVal, el.coreType)
        if (draw !== this.draw) return
        this.setFormData(arrayIndex, el.coreType, el.value)
      }
      return
    }

    if (sectionName) {
      const sectionData = formData?.[sectionName] || {}
      const sectionSchema = formSchema[sectionName]
      const fieldCode = this.props.fieldCode
      Object.keys(sectionSchema).forEach(key => {
        if (key === fieldCode) {
          this.fetchInitialCodelist(sectionData[key])
        } else if (sectionSchema[key]?.['ui:widget'] === 'hidden' && this.isInChain(key, fieldCode, sectionSchema)) {
          formObjectsArray.push({ ...sectionSchema[key], value: sectionData[key], parentVal: sectionData[sectionSchema[key]['dependentOnField']], coreType: key });
        }
      });
    } else {
      const fieldCode = this.props.fieldCode
      Object.keys(formSchema).forEach(key => {
        if (key === fieldCode) {
          this.fetchInitialCodelist(formData[key])
        } else if (formSchema[key]?.['ui:widget'] === 'hidden' && this.isInChain(key, fieldCode, formSchema)) {
          formObjectsArray.push({ ...formSchema[key], value: formData[key], parentVal: formData[formSchema[key]['dependentOnField']], coreType: key });
        }
      });
    }

    const sortedArr = formObjectsArray.sort((a, b) => a.order - b.order);

    for (const el of sortedArr) {
      if (el.parentVal === undefined || el.parentVal === null || el.parentVal === '') break
      await this.generateDropdownInOrder(el.codelistName, sectionName, el.value, el.parentVal, el.coreType);
      if (draw !== this.draw) return
      this.setFormData(sectionName, el.coreType, el.value);
    }
  };

  generateDropdownInOrder = (codelistName, groupPath, selectedVal, parentVal, coreType) => {
    return new Promise((resolve, reject) => {
      const { svSession, tableName, ddVerbPath } = this.props;
      if (codelistName) {
        let wsPath = `ReactElements/getDependentDropdown/sid/${svSession}/codelist-name/${codelistName}/parent-code-value/${parentVal}`;
        if (ddVerbPath) {
          wsPath = ddVerbPath
            .replace('%session', svSession)
            .replace('%tableName', tableName)
            .replace('%selectedVal', parentVal);
        }
        const url = `${window.server}/${wsPath}`;
        const draw = this.draw
        this.setState({ loading: true });
        axios.get(url).then((response) => {
          this.setState({ loading: false });
          if (draw === this.draw && response?.data) {
            let finalResponse = response.data;
            if (isValidObject(finalResponse.data, 1) && isValidArray(finalResponse.data?.items, 1)) {
              finalResponse = finalResponse.data;
            }
            this.generateDropdown(finalResponse, coreType, groupPath, selectedVal);
          }
          resolve();
        }).catch((error) => {
          console.error(error);
          this.setState({ loading: false });
          reject(error);
          alertUserResponse({ response: error })
        });
      } else {
        resolve();
      }
    });
  };

  setFormData = (groupPath, coreType, selectedVal) => {
    if (this.props.formInstance) {
      let newTableData = ComponentManager.getStateForComponent(this.props.formId, 'formTableData')
      if (this.isArraySchema()) {
        if (!this.holdsRows(newTableData)) {
          newTableData = this.props.formInstance.state.formTableData
        }
        newTableData = this.withRowValue(newTableData, Number(groupPath), coreType, selectedVal)
      } else if (groupPath) {
        if (newTableData[groupPath] && newTableData[groupPath].constructor === Object) {
          newTableData[groupPath][coreType] = selectedVal
        } else {
          newTableData[groupPath] = {}
          newTableData[groupPath][coreType] = selectedVal
        }
      } else {
        if (newTableData && newTableData.constructor === Object) {
          newTableData[coreType] = selectedVal
        } else {
          newTableData = {}
          newTableData[coreType] = selectedVal
        }
      }
      ComponentManager.setStateForComponent(this.props.formId, 'formTableData', newTableData)
      this.props.formInstance.setState({ formTableData: newTableData })
    }
  }

  clearFormData = (fieldName, groupPath) => {
    if (this.props.formInstance) {
      let newTableData = ComponentManager.getStateForComponent(this.props.formId, 'formTableData')
      if (this.isArraySchema()) {
        const idx = this.rowIndex(this.props.elementId)
        if (!this.holdsRows(newTableData)) {
          newTableData = this.props.formInstance.state.formTableData
        }
        if (getIn(newTableData, [...this.arrayScope().arrayPath, idx])) {
          newTableData = this.withRowValue(newTableData, idx, fieldName, undefined)
        }
      } else if (groupPath) {
        if (newTableData[groupPath] && newTableData[groupPath].constructor === Object) {
          newTableData[groupPath][fieldName] = undefined
        } else {
          newTableData[groupPath] = {}
          newTableData[groupPath][fieldName] = undefined
        }
      } else {
        if (newTableData && newTableData.constructor === Object) {
          newTableData[fieldName] = undefined
        } else {
          newTableData = {}
          newTableData[fieldName] = undefined
        }
      }
      ComponentManager.setStateForComponent(this.props.formId, 'formTableData', newTableData)
      this.props.formInstance.setState({ formTableData: newTableData })
    }
  }

  // A pick of the user's: what was still being drawn before it is out of date
  onSelect = (elementId, isInitial) => {
    this.draw += 1
    this.onChange(elementId, isInitial)
  }

  onChange = (elementId, isInitial) => {
    const { getAdditionalData, additionalDataKey, selectedInitialValue, formSchema, svSession, ddVerbPath, tableName } = this.props

    const elementProperties = this.findCoreType(elementId)
    let groupPath
    if (this.props.sectionName) {
      groupPath = elementProperties[0]  // "items" for array schemas
    }
    const coreType = elementProperties[1]
    const fieldsSchema = (this.isArraySchema() ? this.itemsUiSchema() : groupPath ? formSchema[groupPath] : formSchema) || {}
    const elementOrder = fieldsSchema[coreType]?.order
    let nextElementObj
    let newElement
    Object.keys(fieldsSchema).forEach(key => {
      if (fieldsSchema[key]?.['ui:widget'] === 'hidden' && fieldsSchema[key]?.dependentOnField === coreType && fieldsSchema[key]?.order === elementOrder + 1) {
        nextElementObj = fieldsSchema[key]
        newElement = key
      }
    })
    const codelistName = nextElementObj?.codelistName || ''

    // For array schemas the element ID uses the numeric array index, not "items"
    const generateGroupPath = this.isArraySchema()
      ? this.rowIndex(elementId)
      : groupPath

    // Every level below this one, drawn yet or not: a value there belonged to the old pick
    const prefix = elementId.slice(0, elementId.length - coreType.length)
    const below = Object.keys(fieldsSchema).filter(key => fieldsSchema[key]?.['ui:widget'] === 'hidden' && this.isInChain(key, coreType, fieldsSchema))
    if (below.length > 0) {
      const removed = new Set(below.map(field => prefix + field))
      this.setState(state => ({ dynamicDropdowns: state.dynamicDropdowns.filter(entry => !removed.has(entry.id)) }))
      below.forEach(field => {
        this.shown = { ...this.shown, [field]: '' }
        this.clearFormData(field, groupPath)
      })
    }

    // Dropdowns only: configuration inputs share these element IDs.
    let el
    const list = document.getElementsByTagName('SELECT')
    let dropdownId = elementId
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === dropdownId) {
        el = list[i]
      }
    }
    let selectedVal = el.options[el.selectedIndex].value
    if (selectedInitialValue && isInitial) {
      selectedVal = selectedInitialValue
    }
    this.shown = { ...this.shown, [coreType]: selectedVal == null ? '' : String(selectedVal) }

    if (this.props.formInstance) {
      let newTableData
      if (this.isArraySchema()) {
        // clearFormData updates ComponentManager synchronously; read from it so we
        // see the cleared dependent fields instead of the stale pre-batch React state.
        let currentData = ComponentManager.getStateForComponent(this.props.formId, 'formTableData')
        if (!this.holdsRows(currentData)) {
          currentData = this.props.formInstance.state.formTableData
        }
        newTableData = this.withRowValue(currentData, this.rowIndex(elementId), coreType, selectedVal)
        ComponentManager.setStateForComponent(this.props.formId, 'formTableData', newTableData)
      } else {
        newTableData = Object.assign({}, this.props.formInstance.state.formTableData)
        if (groupPath) {
          if (newTableData[groupPath] && newTableData[groupPath].constructor === Object) {
            newTableData[groupPath][coreType] = selectedVal
          } else {
            newTableData[groupPath] = {}
            newTableData[groupPath][coreType] = selectedVal
          }
        } else {
          if (newTableData && newTableData.constructor === Object) {
            newTableData[coreType] = selectedVal
          } else {
            newTableData = {}
            newTableData[coreType] = selectedVal
          }
        }
      }
      this.props.formInstance.setState({ formTableData: newTableData })
    }

    if (codelistName) {
      let wsPath = `ReactElements/getDependentDropdown/sid/${svSession}/codelist-name/${codelistName}/parent-code-value/${selectedVal}`
      if (ddVerbPath) {
        wsPath = ddVerbPath
        wsPath = wsPath.replace('%session', svSession)
        wsPath = wsPath.replace('%tableName', tableName)
        wsPath = wsPath.replace('%selectedVal', selectedVal)
      }
      this.setState({ loading: true })
      const url = `${window.server}/${wsPath}`
      const draw = this.draw
      axios.get(url).then((response) => {
        this.setState({ loading: false })
        if (draw === this.draw && response?.data?.data) {
          if (getAdditionalData && additionalDataKey && response?.data?.data?.[additionalDataKey]) {
            store.dispatch({ type: 'ADDITIONAL_DEPENDENT_DROPDOWN_DATA', payload: response.data?.data?.[additionalDataKey] })
          }
          let finalResponse = response.data
          if (isValidObject(finalResponse.data, 1) && isValidArray(finalResponse.data?.items, 1)) {
            finalResponse = finalResponse.data
          }
          this.generateDropdown(finalResponse, newElement, generateGroupPath)
        }
      }).catch((error) => {
        console.error(error)
        this.setState({ loading: false })
        alertUserResponse({ response: error })
      })
    }
  }

  generateDropdown = (dbDataArray, newElement, groupPath, selectedVal) => {
    let prefix = 'root_'
    if (this.isArraySchema()) {
      prefix = this.rowPrefix(Number(groupPath))
    } else if (groupPath) {
      prefix = 'root_' + groupPath + '_'
    }
    const elementId = prefix + newElement
    const coreType = newElement || this.findCoreType(elementId)[1]
    let options = [{
      id: 'default',
      key: 'default',
      name: 'default',
      value: '',
      selected: true,
      disabled: true,
      hidden: true
    }]

    if (dbDataArray.items && Array.isArray(dbDataArray.items)) {
      for (let i = 0; i < dbDataArray.items.length; i++) {
        let decodedValue = dbDataArray.items[i]['LBL_TRANSL']
        let selected = false
        if (selectedVal && selectedVal === dbDataArray.items[i]['CODE_VALUE']) {
          selected = true
        }
        options.push({
          id: dbDataArray.items[i]['object_id'],
          key: dbDataArray.items[i]['object_id'],
          name: dbDataArray.items[i]['CODE_VALUE'],
          value: dbDataArray.items[i]['CODE_VALUE'],
          text: decodedValue,
          selected: selected
        })
      }

      // Published by field name, so a DependentValueField watching this field needs no request.
      if (this.props.formInstance) {
        const existingDependentFieldData = ComponentManager.getStateForComponent(this.props.formId, 'dependentFieldData') || {}
        const rowsByCode = {}
        dbDataArray.items.forEach(item => { rowsByCode[item['CODE_VALUE']] = item })
        ComponentManager.setStateForComponent(this.props.formId, 'dependentFieldData', {
          ...existingDependentFieldData,
          [coreType]: rowsByCode
        })
      }
    }

    let labelText
    let requiredFieldsArr
    if (this.isArraySchema()) {
      labelText = this.getArrayItemTitle(coreType)
      requiredFieldsArr = this.itemsJsonSchema()?.required
    } else if (!this.props.sectionName) {
      labelText = this.getSchemaProperty(this.props.formConfig, coreType)?.title
      requiredFieldsArr = this.props.formConfig.required
    } else {
      labelText = this.getSchemaProperty(this.props.formConfig.properties[this.props.sectionName], coreType)?.title
      requiredFieldsArr = this.props.formConfig.properties[this.props.sectionName].required
    }
    let requiredAttr = false
    if (isValidArray(requiredFieldsArr, 1) && requiredFieldsArr.includes(coreType)) {
      requiredAttr = true
    }

    const chainDropdown = <Dropdown
      className='dependent-dropdown'
      id={elementId}
      style={this.props.hideInternalLabel ? undefined : this.additionalStyle}
      labelText={this.props.hideInternalLabel ? undefined : labelText}
      key={elementId + '_depddl'}
      name={elementId}
      onChange={() => this.onSelect(elementId)}
      options={options}
      required={requiredAttr}
    />

    let chainElement
    if (this.props.hideInternalLabel) {
      const chainUiSchema = this.isArraySchema()
        ? this.itemsUiSchema()[coreType]
        : this.props.sectionName
          ? this.props.formSchema?.[this.props.sectionName]?.[coreType]
          : this.props.formSchema?.[coreType]
      const chainHelpCode = chainUiSchema?.['ui:helpCode'] || null
      chainElement = (
        <div key={elementId + '_wrap'} className='dependent-dropdown-wrapper' style={this.additionalStyle}>
          <div className='admin-console-field-label-row'>
            <label className='control-label'>
              {labelText}
              {requiredAttr && <span className='required'>{'*'}</span>}
            </label>
            {chainHelpCode && <FieldHelpButton labelCode={chainHelpCode} />}
          </div>
          {chainDropdown}
        </div>
      )
    } else {
      chainElement = chainDropdown
    }

    // Replaces a dropdown already drawn for this field rather than drawing it twice
    this.setState(state => {
      const entry = { id: elementId, element: chainElement }
      const drawn = state.dynamicDropdowns.some(other => other.id === elementId)
      return { dynamicDropdowns: drawn ? state.dynamicDropdowns.map(other => other.id === elementId ? entry : other) : [...state.dynamicDropdowns, entry] }
    })
  }

  render() {
    return (
      <React.Fragment>
        {this.state.loading && <Loading />}
        {this.state.initialDropdown}
        {this.state.dynamicDropdowns.map(entry => entry.element)}
      </React.Fragment>
    )
  }
}

function mapStateToProps(state) {
  return {
    svSession: state.security.svSession
  }
}

export default connect(mapStateToProps)(DependentElements)
