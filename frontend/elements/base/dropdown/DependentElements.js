import React from 'react';
import axios from 'axios';
import { connect } from 'react-redux';
import { store } from '../../../model'
import { svConfig } from '../../../config';
import { Dropdown, ComponentManager, alertUserResponse } from '../..';
import { Loading } from '../../../components/ComponentsIndex';
import { isValidArray, isValidObject, getArrayIndexFromElementId } from '../../../functions/utils';
import FieldHelpButton from '../../fieldHelp/FieldHelpButton';

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

// represents the internal dependency dropdown logic
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
    this.style = right
    this.additionalStyle = additionalStyle
    if (this.props.spread === 'down') {
      this.style = down
      this.additionalStyle = down
    }
  }

  isArraySchema = () => {
    return this.props.formConfig?.type === 'array'
  }

  // Looks up a field title in array schema, checking allOf conditional branches as fallback.
  getArrayItemTitle = (coreType) => {
    const items = this.props.formConfig?.items
    if (!items) return undefined
    if (items.properties?.[coreType]?.title) return items.properties[coreType].title
    for (const clause of (items.allOf || [])) {
      if (clause.then?.properties?.[coreType]?.title) return clause.then.properties[coreType].title
    }
    return undefined
  }

  // Looks up a property definition from the JSON schema, checking allOf conditional branches as fallback.
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

  componentDidMount() {
    const { formConfig, sectionName } = this.props
    const formData = this.props.formData

    if (this.isArraySchema()) {
      const arrayIndex = parseInt(getArrayIndexFromElementId(this.props.elementId))
      const rowData = Array.isArray(formData) ? formData[arrayIndex] : null
      if (rowData && Object.keys(rowData).length > 0) {
        this.generateExisting()
      } else {
        this.fetchInitialCodelist()
      }
      return
    }

    const formDataCopy = Object.assign({}, formData)
    if (formDataCopy && formDataCopy.constructor === Object && Object.keys(formDataCopy).length > 0) {
      if (sectionName) { //section
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
        // Append an empty string as the value of each field that doesn't have a value
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

  fetchInitialCodelist = (selectedVal) => {
    const { elementId, triggerAutoDependentDropdownOnChange, disableInitialDependentDropdown } = this.props
    let verbPath = svConfig.triglavRestVerbs.GET_TABLE_WITH_FILTER
    if (!verbPath) {
      console.warn('Missing GET TABLE WS in configuration')
      return
    }
    let codelistName
    if (this.props.sectionName) {
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
    this.setState({ loading: true })
    axios.get(restUrl).then((response) => {
      this.setState({ loading: false })
      if (response?.data) {
        this.generateInitialDropdown(response.data, elementId, selectedVal, triggerAutoDependentDropdownOnChange, disableInitialDependentDropdown)
      }
    }).catch((error) => {
      console.error(error)
      this.setState({ loading: false })
    })
  }

  componentWillUnmount = () => {
    if (!this.isArraySchema()) return

    const { fieldCode, formSchema } = this.props
    const itemsSchema = formSchema?.items || {}
    const arrayIndex = getArrayIndexFromElementId(this.props.elementId)

    // Remove DOM-injected chain dropdowns (not the React-managed root).
    Array.from(document.getElementsByClassName('dependent-dropdown')).forEach(el => {
      if (getArrayIndexFromElementId(el.id) !== arrayIndex) return
      const elCoreType = this.findCoreType(el.id)[1]
      if (!this.isInChain(elCoreType, fieldCode, itemsSchema)) return
      el.parentNode?.parentNode?.removeChild(el.parentNode)
    })

    // rjsf unmounts this component before GenericForm's onChange fires, so
    // ComponentManager is stale here. Defer until after onChange has updated it.
    setTimeout(() => {
      if (!document.getElementById(this.props.formId)) return
      this.clearFormData(fieldCode)
      Object.keys(itemsSchema).forEach(key => {
        if (this.isInChain(key, fieldCode, itemsSchema)) {
          this.clearFormData(key)
        }
      })
    }, 0)
  }

  findCoreType = (stringId) => {
    if (this.isArraySchema()) {
      // elementId is "root_0_DEPARTMENT" or "root_0_LAB_OBJ_ID"
      // Schema lookups use sectionName ("items"); strip "root_{index}_" to get the field name.
      const withoutRoot = stringId.replace(/^root_/, '')
      const coreType = withoutRoot.substring(withoutRoot.indexOf('_') + 1)
      return [this.props.sectionName, coreType]
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

  generateInitialDropdown = (dbDataArray, elementId, selectedVal, triggerAutoOnChange, isDisabled) => {
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
      requiredFieldsArr = this.props.formConfig.items.required
    } else if (!this.props.sectionName) {
      labelText = this.getSchemaProperty(this.props.formConfig, coreType)?.title
      requiredFieldsArr = this.props.formConfig.required
    } else {
      labelText = this.props.formConfig.properties[this.props.sectionName].properties[coreType].title
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
      onChange={() => this.onChange(elementId, true)}
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

  generateExisting = async () => {
    const { formSchema, sectionName, formData, elementId } = this.props;
    let formObjectsArray = [];

    if (this.isArraySchema()) {
      const arrayIndex = getArrayIndexFromElementId(elementId)
      const itemsSchema = formSchema['items'] || {}
      const rowData = Array.isArray(formData) ? (formData[parseInt(arrayIndex)] || {}) : {}
      const fieldCode = this.props.fieldCode

      Object.keys(itemsSchema).forEach(key => {
        if (key === fieldCode) {
          // Root of this chain: fetch its codelist (with any existing selected value)
          this.fetchInitialCodelist(rowData[key])
        } else if (itemsSchema[key]?.['ui:widget'] === 'hidden' && this.isInChain(key, fieldCode, itemsSchema)) {
          // Only DOM-injected chain dropdowns belong here. A field can declare
          // dependentOnField for its own unrelated reasons (e.g. DependentValueField
          // deriving its value from a separate codelist) without being part of
          // this hidden-dropdown chain.
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
        // If parent has no value, the chain stops here — don't fetch further dependents
        if (el.parentVal === undefined || el.parentVal === null || el.parentVal === '') break
        await this.generateDropdownInOrder(el.codelistName, arrayIndex, el.value, el.parentVal, el.coreType)
        this.setFormData(arrayIndex, el.coreType, el.value)
      }
      return
    }

    if (sectionName) {
      const sectionData = formData?.[sectionName] || {}
      Object.keys(formSchema[sectionName]).forEach(key => {
        if (formSchema[sectionName][key]?.order === 0) {
          this.fetchInitialCodelist(sectionData[key])
        } else if (formSchema[sectionName][key]?.['ui:widget'] === 'hidden' && formSchema[sectionName][key]?.order) {
          formObjectsArray.push({ ...formSchema[sectionName][key], value: sectionData[key], parentVal: sectionData[formSchema[sectionName][key]['dependentOnField']], coreType: key });
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
        this.setState({ loading: true });
        axios.get(url).then((response) => {
          this.setState({ loading: false });
          if (response?.data) {
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
        const idx = parseInt(groupPath)
        if (!Array.isArray(newTableData)) {
          newTableData = this.props.formInstance.state.formTableData
        }
        const baseArray = Array.isArray(newTableData) ? newTableData.map(item => ({ ...item })) : []
        baseArray[idx] = { ...(baseArray[idx] || {}), [coreType]: selectedVal }
        newTableData = baseArray
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
        const idx = parseInt(getArrayIndexFromElementId(this.props.elementId))
        if (!Array.isArray(newTableData)) {
          newTableData = this.props.formInstance.state.formTableData
        }
        if (Array.isArray(newTableData) && newTableData[idx]) {
          const baseArray = newTableData.map(item => ({ ...item }))
          baseArray[idx] = { ...baseArray[idx], [fieldName]: undefined }
          newTableData = baseArray
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

  removeElements = (parentNode, ddls, index) => {
    parentNode.removeChild(ddls[index])
    if (parentNode.childNodes.length > 0) {
      parentNode.removeChild(parentNode.childNodes[0])
    }
    const wrapper = parentNode.parentNode
    wrapper.removeChild(parentNode)
    if (wrapper.classList?.contains('dependent-dropdown-wrapper')) {
      wrapper.parentNode?.removeChild(wrapper)
    }
  }

  onChange = (elementId, isInitial) => {
    const { getAdditionalData, additionalDataKey, selectedInitialValue, formSchema, svSession, ddVerbPath, tableName } = this.props

    const elementProperties = this.findCoreType(elementId)
    let groupPath
    if (this.props.sectionName) {
      groupPath = elementProperties[0]  // "items" for array schemas
    }
    const coreType = elementProperties[1]
    let elementOrder = formSchema[coreType]?.order
    if (groupPath) {
      elementOrder = formSchema[groupPath][coreType]?.order
    }
    let nextElementObj
    let newElement
    Object.keys(formSchema).forEach(key => {
      if (groupPath) {
        if (key === groupPath) {
          const sectionFormSchema = formSchema[groupPath]
          Object.keys(sectionFormSchema).forEach(nestedKey => {
            if (sectionFormSchema[nestedKey]?.['ui:widget'] === 'hidden' && sectionFormSchema[nestedKey]?.dependentOnField === coreType && sectionFormSchema[nestedKey]?.order === elementOrder + 1) {
              nextElementObj = sectionFormSchema[nestedKey]
              newElement = nestedKey
            }
          })
        }
      } else {
        if (formSchema[key]?.['ui:widget'] === 'hidden' && formSchema[key]?.dependentOnField === coreType && formSchema[key]?.order === elementOrder + 1) {
          nextElementObj = formSchema[key]
          newElement = key
        }
      }
    })
    const codelistName = nextElementObj?.codelistName || ''

    // For array schemas the element ID uses the numeric array index, not "items"
    const generateGroupPath = this.isArraySchema()
      ? getArrayIndexFromElementId(elementId)
      : groupPath

    try {
      const form = document.getElementById(this.props.formId)
      const ddls = Array.from(document.getElementsByClassName('dependent-dropdown'));
      const index = ddls.findIndex(el => el.id === elementId);
      if (index > -1) {
        ddls.slice(index + 1).forEach((el, i) => {
          if (this.isArraySchema()) {
            if (getArrayIndexFromElementId(el.id) !== getArrayIndexFromElementId(elementId)) {
              return
            }
            // Skip elements that belong to a different dependency chain
            const elCoreType = this.findCoreType(el.id)[1]
            if (!this.isInChain(elCoreType, this.props.fieldCode, this.props.formSchema?.items || {})) {
              return
            }
          }
          if (form?.contains(el)) {
            const parentNode = el.parentNode;
            el.value = '';
            if (parentNode) {
              this.removeElements(parentNode, ddls, index + 1 + i); // Adjusted the index for slice iteration
            }
            this.clearFormData(this.findCoreType(el.id)[1], groupPath);
          }
        });
      }
    } catch (error) { // eslint-disable-line
      throw error
    } finally {
      /* search only for dropdowns, since there are inputs with the same element
      IDs prsent in the document - from configuration */
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

      if (this.props.formInstance) {
        let newTableData
        if (this.isArraySchema()) {
          const idx = parseInt(getArrayIndexFromElementId(elementId))
          // clearFormData updates ComponentManager synchronously; read from it so we
          // see the cleared dependent fields instead of the stale pre-batch React state.
          let currentData = ComponentManager.getStateForComponent(this.props.formId, 'formTableData')
          if (!Array.isArray(currentData)) {
            currentData = this.props.formInstance.state.formTableData
          }
          const baseArray = Array.isArray(currentData) ? currentData.map(item => ({ ...item })) : []
          baseArray[idx] = { ...(baseArray[idx] || {}), [coreType]: selectedVal }
          newTableData = baseArray
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
          // Replace some of the params in the provided WS path
          wsPath = ddVerbPath
          wsPath = wsPath.replace('%session', svSession)
          wsPath = wsPath.replace('%tableName', tableName)
          wsPath = wsPath.replace('%selectedVal', selectedVal)
        }
        this.setState({ loading: true })
        const url = `${window.server}/${wsPath}`
        axios.get(url).then((response) => {
          this.setState({ loading: false })
          if (response?.data?.data) {
            if (getAdditionalData && additionalDataKey && response?.data?.data?.[additionalDataKey]) {
              store.dispatch({ type: 'ADDITIONAL_DEPENDENT_DROPDOWN_DATA', payload: response.data?.data?.[additionalDataKey] })
            }
            let finalResponse = response.data
            // Check if the data is nested
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
  }

  generateDropdown = (dbDataArray, newElement, groupPath, selectedVal) => {
    let prefix = 'root'
    if (groupPath) {
      prefix = 'root_' + groupPath
    }
    const elementId = prefix + '_' + newElement
    const coreType = newElement || this.findCoreType(elementId)[1]
    // Default blank dropdown option
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
      // Create dropdown options
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

      // Publish the fetched rows keyed by field name, so a DependentValueField
      // watching this field (via dependentOnField) can derive its value from
      // the row already fetched here, with no extra request.
      const existingDependentFieldData = ComponentManager.getStateForComponent(this.props.formId, 'dependentFieldData') || {}
      const rowsByCode = {}
      dbDataArray.items.forEach(item => { rowsByCode[item['CODE_VALUE']] = item })
      ComponentManager.setStateForComponent(this.props.formId, 'dependentFieldData', {
        ...existingDependentFieldData,
        [coreType]: rowsByCode
      })
    }

    // Generate the dropdown selector, labels and icons
    const ddlList = this.state.dynamicDropdowns.slice()

    let labelText
    let requiredFieldsArr
    if (this.isArraySchema()) {
      labelText = this.getArrayItemTitle(coreType)
      requiredFieldsArr = this.props.formConfig.items.required
    } else if (!this.props.sectionName) {
      labelText = this.getSchemaProperty(this.props.formConfig, coreType)?.title
      requiredFieldsArr = this.props.formConfig.required
    } else {
      labelText = this.props.formConfig.properties[this.props.sectionName].properties[coreType]?.title
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
      onChange={() => this.onChange(elementId)}
      options={options}
      required={requiredAttr}
    />

    let chainElement
    if (this.props.hideInternalLabel) {
      const chainUiSchema = this.isArraySchema()
        ? this.props.formSchema?.['items']?.[coreType]
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

    ddlList.push(chainElement)
    this.setState({ dynamicDropdowns: ddlList })
  }

  render() {
    return (
      <React.Fragment>
        {this.state.loading && <Loading />}
        {this.state.initialDropdown}
        {this.state.dynamicDropdowns}
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
