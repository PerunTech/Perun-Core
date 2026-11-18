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

const sameSection = (a, b) => a.length === b.length && a.every((key, index) => key === b[index])

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

  // Where the array sits in the form data, and where a row keeps the root's field; both empty for a root array
  arrayScope = () => this.props.arrayScope || { arrayPath: [], itemPath: [] }

  // A section is a path in the row's item, [] for the item itself
  rowPath = (index, section = this.arrayScope().itemPath) => [...this.arrayScope().arrayPath, index, ...section]

  itemsUiSchema = (section) => uiSchemaAtPath(this.props.formSchema, this.rowPath(0, section)) || {}

  itemsJsonSchema = (section) => schemaAtPath(this.props.formConfig, this.rowPath(0, section))

  rowPrefix = (index, section) => `${['root', ...this.rowPath(index, section)].join('_')}_`

  // The row an element ID belongs to; null for an element of another array
  rowIndex = (elementId) => {
    const head = `${['root', ...this.arrayScope().arrayPath].join('_')}_`
    const index = elementId?.startsWith(head) ? elementId.slice(head.length).match(/^(\d+)_/)?.[1] : undefined
    return index !== undefined && elementId.startsWith(this.rowPrefix(Number(index))) ? Number(index) : null
  }

  holdsRows = (tableData) => Array.isArray(getIn(tableData, this.arrayScope().arrayPath))

  withRowValue = (tableData, level, value) => setIn(tableData, [...this.rowPath(Number(level.row), level.section), level.key], value)

  // Falls back to allOf's conditional branches.
  getSchemaProperty = (formConfig, coreType) => {
    if (formConfig?.properties?.[coreType]) return formConfig.properties[coreType]
    for (const clause of (formConfig?.allOf || [])) {
      if (clause.then?.properties?.[coreType]) return clause.then.properties[coreType]
    }
    return undefined
  }

  idOf = (section, key) => {
    if (section === (this.props.sectionName || '') && key === this.props.fieldCode) return this.props.elementId
    return section ? `root_${section}_${key}` : `root_${key}`
  }

  rootLevel = () => this.isArraySchema()
    ? { id: this.props.elementId, key: this.props.fieldCode, row: this.rowIndex(this.props.elementId), section: this.arrayScope().itemPath }
    : { id: this.props.elementId, key: this.props.fieldCode, section: this.props.sectionName || '' }

  // Every field of the root's row, in each section of the item as well as the root's own, linked as formFields links them
  rowFields = (row) => {
    const { itemPath } = this.arrayScope()
    const item = this.itemsUiSchema([])
    const isSection = key => this.itemsJsonSchema([key])?.type === 'object' &&
      item[key] && typeof item[key] === 'object' && !Array.isArray(item[key])
    const sections = [itemPath, [], ...Object.keys(item).filter(isSection).map(key => [key])]
      .filter((section, index, all) => all.findIndex(other => sameSection(other, section)) === index)
    const listed = sections.flatMap(section => {
      const fields = section.length ? uiSchemaAtPath(item, section) || {} : item
      return Object.keys(fields).filter(key => section.length || !isSection(key)).map(key => ({ section, key, ui: fields[key] }))
    })
    return listed.map(field => {
      const on = field.ui?.dependentOnField
      const holder = on ? [field.section, ...sections].find(section => listed.some(other => sameSection(other.section, section) && other.key === on)) : undefined
      return { ...field, row, id: this.rowPrefix(row, field.section) + field.key, parent: holder && this.rowPrefix(row, holder) + on }
    })
  }

  // Every field of the form, each section's and the top level's (section ''). A field hangs off the one it
  // names in its own section, else off the first section holding that name, so a chain can cross sections.
  formFields = () => {
    const { formSchema, formConfig, sectionName } = this.props
    const isSection = key => key === sectionName || (formConfig?.properties?.[key]?.type === 'object' &&
      formSchema[key] && typeof formSchema[key] === 'object' && !Array.isArray(formSchema[key]))
    const listed = []
    Object.keys(formSchema || {}).forEach(key => {
      if (isSection(key)) {
        Object.keys(formSchema[key] || {}).forEach(field => listed.push({ section: key, key: field, ui: formSchema[key][field] }))
      } else {
        listed.push({ section: '', key, ui: formSchema[key] })
      }
    })
    const sections = [...new Set(listed.map(field => field.section))]
    return listed.map(field => {
      const on = field.ui?.dependentOnField
      const holder = on ? [field.section, ...sections].find(section => listed.some(other => other.section === section && other.key === on)) : undefined
      return { ...field, id: this.idOf(field.section, field.key), parent: holder === undefined ? undefined : this.idOf(holder, on) }
    })
  }

  ancestors = (field, byId) => {
    const out = []
    for (let parent = field.parent; parent && !out.includes(parent); parent = byId[parent]?.parent) out.push(parent)
    return out
  }

  // The fields below the root, parents first; levels are the hidden ones, which the chain draws as dropdowns
  chain = () => {
    const root = this.rootLevel()
    const all = this.isArraySchema() ? this.rowFields(root.row) : this.formFields()
    const byId = Object.fromEntries(all.map(field => [field.id, field]))
    byId[root.id] = root
    const fields = all
      .map((field, index) => ({ ...field, index, depth: this.ancestors(field, byId).indexOf(root.id) + 1 }))
      .filter(field => field.id !== root.id && field.depth > 0)
      .sort((a, b) => a.depth - b.depth || (a.ui?.order ?? 0) - (b.ui?.order ?? 0) || a.index - b.index)
    fields.forEach(field => { byId[field.id] = field })
    return { root, fields, levels: fields.filter(field => field.ui?.['ui:widget'] === 'hidden'), byId }
  }

  valueOf = (level, data) => {
    if (!level) return undefined
    if (level.row !== undefined) return getIn(data, [...this.rowPath(level.row, level.section), level.key])
    return level.section ? data?.[level.section]?.[level.key] : data?.[level.key]
  }

  fieldSchema = (level) => {
    const holder = level.row !== undefined ? this.itemsJsonSchema(level.section)
      : level.section ? this.props.formConfig?.properties?.[level.section] : this.props.formConfig
    return { title: this.getSchemaProperty(holder, level.key)?.title, required: holder?.required }
  }

  dependentUrl = (codelistName, parentVal) => {
    const { svSession, tableName, ddVerbPath } = this.props
    const wsPath = ddVerbPath
      ? ddVerbPath.replace('%session', svSession).replace('%tableName', tableName).replace('%selectedVal', parentVal)
      : `ReactElements/getDependentDropdown/sid/${svSession}/codelist-name/${codelistName}/parent-code-value/${parentVal}`
    return `${window.server}/${wsPath}`
  }

  chainValues = (formData) => {
    const { root, levels } = this.chain()
    const chain = {}
    for (const level of [root, ...levels]) {
      const value = this.valueOf(level, formData)
      chain[level.id] = value == null ? '' : String(value)
    }
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

    const { root, fields, levels } = this.chain()

    // Remove DOM-injected chain dropdowns (not the React-managed root).
    const drawn = new Set(levels.map(level => level.id))
    Array.from(document.getElementsByClassName('dependent-dropdown')).forEach(el => {
      if (drawn.has(el.id)) el.parentNode?.parentNode?.removeChild(el.parentNode)
    })

    // rjsf unmounts this component before GenericForm's onChange fires, so
    // ComponentManager is stale here. Defer until after onChange has updated it.
    const rowsBefore = this.rowCount()
    const row = document.getElementById(this.rowPrefix(root.row).slice(0, -1))
    setTimeout(() => {
      // The row went with the chain (removed, or remounted for a record with another number of rows):
      // the values at its index now belong to another row
      if (!document.getElementById(this.props.formId) || this.rowCount() !== rowsBefore || row?.isConnected === false) return
      for (const field of [root, ...fields]) this.clearFormData(field)
    }, 0)
  }

  rowCount = () => getIn(this.currentFormData(), this.arrayScope().arrayPath)?.length

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

    const coreType = this.props.fieldCode
    const { title: labelText, required: requiredFieldsArr } = this.fieldSchema(this.rootLevel())
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
    const draw = this.draw
    const { root, levels, byId } = this.chain()
    this.fetchInitialCodelist(this.valueOf(root, formData))
    // A parent without a value ends its branch
    const skipped = new Set()
    for (const level of levels) {
      const parentVal = this.valueOf(byId[level.parent], formData)
      if (skipped.has(level.parent) || parentVal === undefined || parentVal === null || parentVal === '') {
        skipped.add(level.id)
        continue
      }
      const value = this.valueOf(level, formData)
      await this.generateDropdownInOrder(level, value, parentVal)
      if (draw !== this.draw) return
      this.setFormData(level, value)
    }
  }

  generateDropdownInOrder = (level, selectedVal, parentVal) => {
    return new Promise((resolve, reject) => {
      const codelistName = level.ui?.codelistName
      if (codelistName) {
        const draw = this.draw
        this.setState({ loading: true });
        axios.get(this.dependentUrl(codelistName, parentVal)).then((response) => {
          this.setState({ loading: false });
          if (draw === this.draw && response?.data) {
            let finalResponse = response.data;
            if (isValidObject(finalResponse.data, 1) && isValidArray(finalResponse.data?.items, 1)) {
              finalResponse = finalResponse.data;
            }
            this.generateDropdown(finalResponse, level, selectedVal);
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

  writeLevel = (level, value, clearing) => {
    if (!this.props.formInstance) return
    let newTableData = ComponentManager.getStateForComponent(this.props.formId, 'formTableData')
    if (level.row !== undefined) {
      if (!this.holdsRows(newTableData)) {
        newTableData = this.props.formInstance.state.formTableData
      }
      if (!clearing || getIn(newTableData, [...this.arrayScope().arrayPath, level.row])) {
        newTableData = this.withRowValue(newTableData, level, value)
      }
    } else if (level.section) {
      if (!(newTableData[level.section] && newTableData[level.section].constructor === Object)) {
        newTableData[level.section] = {}
      }
      newTableData[level.section][level.key] = value
    } else {
      if (!(newTableData && newTableData.constructor === Object)) {
        newTableData = {}
      }
      newTableData[level.key] = value
    }
    ComponentManager.setStateForComponent(this.props.formId, 'formTableData', newTableData)
    this.props.formInstance.setState({ formTableData: newTableData })
  }

  setFormData = (level, value) => this.writeLevel(level, value, false)

  clearFormData = (level) => this.writeLevel(level, undefined, true)

  // A pick of the user's: what was still being drawn before it is out of date
  onSelect = (elementId, isInitial) => {
    this.draw += 1
    this.onChange(elementId, isInitial)
  }

  onChange = (elementId, isInitial) => {
    const { getAdditionalData, additionalDataKey, selectedInitialValue } = this.props
    const { levels, byId } = this.chain()
    const level = byId[elementId]
    if (!level) return

    // Every level below this one, drawn yet or not: a value there belonged to the old pick
    const below = levels.filter(other => this.ancestors(other, byId).includes(elementId))
    if (below.length > 0) {
      const removed = new Set(below.map(other => other.id))
      this.setState(state => ({ dynamicDropdowns: state.dynamicDropdowns.filter(entry => !removed.has(entry.id)) }))
      below.forEach(other => {
        this.shown = { ...this.shown, [other.id]: '' }
        this.clearFormData(other)
      })
    }

    // Dropdowns only: configuration inputs share these element IDs.
    let el
    const list = document.getElementsByTagName('SELECT')
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === elementId) {
        el = list[i]
      }
    }
    let selectedVal = el.options[el.selectedIndex].value
    if (selectedInitialValue && isInitial) {
      selectedVal = selectedInitialValue
    }
    this.shown = { ...this.shown, [elementId]: selectedVal == null ? '' : String(selectedVal) }

    if (this.props.formInstance) {
      let newTableData
      if (level.row !== undefined) {
        // clearFormData updates ComponentManager synchronously; read from it so we
        // see the cleared dependent fields instead of the stale pre-batch React state.
        let currentData = ComponentManager.getStateForComponent(this.props.formId, 'formTableData')
        if (!this.holdsRows(currentData)) {
          currentData = this.props.formInstance.state.formTableData
        }
        newTableData = this.withRowValue(currentData, level, selectedVal)
        ComponentManager.setStateForComponent(this.props.formId, 'formTableData', newTableData)
      } else {
        newTableData = Object.assign({}, this.props.formInstance.state.formTableData)
        if (level.section) {
          if (!(newTableData[level.section] && newTableData[level.section].constructor === Object)) {
            newTableData[level.section] = {}
          }
          newTableData[level.section][level.key] = selectedVal
        } else {
          newTableData[level.key] = selectedVal
        }
      }
      this.props.formInstance.setState({ formTableData: newTableData })
    }

    const next = levels.filter(other => other.parent === elementId && other.ui?.codelistName)
    if (next.length === 0) return
    const draw = this.draw
    let pending = next.length
    this.setState({ loading: true })
    const settled = () => {
      pending -= 1
      if (pending === 0) this.setState({ loading: false })
    }
    next.forEach(child => {
      axios.get(this.dependentUrl(child.ui.codelistName, selectedVal)).then((response) => {
        settled()
        if (draw === this.draw && response?.data?.data) {
          if (getAdditionalData && additionalDataKey && response?.data?.data?.[additionalDataKey]) {
            store.dispatch({ type: 'ADDITIONAL_DEPENDENT_DROPDOWN_DATA', payload: response.data?.data?.[additionalDataKey] })
          }
          let finalResponse = response.data
          if (isValidObject(finalResponse.data, 1) && isValidArray(finalResponse.data?.items, 1)) {
            finalResponse = finalResponse.data
          }
          this.generateDropdown(finalResponse, child)
        }
      }).catch((error) => {
        console.error(error)
        settled()
        alertUserResponse({ response: error })
      })
    })
  }

  generateDropdown = (dbDataArray, level, selectedVal) => {
    const elementId = level.id
    const coreType = level.key
    // Nothing to pick from for this parent value, so the level is left out
    if (!isValidArray(dbDataArray?.items, 1)) {
      this.setState(state => ({ dynamicDropdowns: state.dynamicDropdowns.filter(entry => entry.id !== elementId) }))
      return
    }
    let options = [{
      id: 'default',
      key: 'default',
      name: 'default',
      value: '',
      selected: true,
      disabled: true,
      hidden: true
    }]

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

    const { title: labelText, required: requiredFieldsArr } = this.fieldSchema(level)
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
      const chainHelpCode = level.ui?.['ui:helpCode'] || null
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
    // In chain order, whichever answer came back first
    const rank = new Map(this.chain().levels.map((level, index) => [level.id, index]))
    const dropdowns = [...this.state.dynamicDropdowns].sort((a, b) => (rank.get(a.id) ?? rank.size) - (rank.get(b.id) ?? rank.size))
    return (
      <React.Fragment>
        {this.state.loading && <Loading />}
        {this.state.initialDropdown}
        {dropdowns.map(entry => entry.element)}
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
