import React from 'react';
import PropTypes from 'prop-types';
import Form from '@rjsf/core';
import { connect } from 'react-redux';
import HelpFieldTemplate from '../fieldHelp/HelpFieldTemplate';
import HelpContext from '../fieldHelp/HelpContext';

import Select from 'react-select';
import createFilterOptions from "react-select-fast-filter-options";
import { labelBasePath } from '../../config/config';
import { getFormData, saveFormData, dropLinkObjectsAction, store } from '../../model';
import { WrapItUp, DependencyDropdown, DependentValueField, findWidget, findSectionName, alertUserV2, alertUserResponse } from '..';
import { CustomOnchangeFunction } from './CustomOnchangeFunction'
import validator from '@rjsf/validator-ajv8';
import { Loading } from '../../components/ComponentsIndex';
import { getObjectValueByKey, isValidObject, getArrayIndexFromElementId, hasHelpCode, applySchemaDefaults } from '../../functions/utils';
let fieldName
let fieldValue

class GenericForm extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      formData: this.props.formData,
      id: this.props.id,
      params: this.props.params,
      tableName: this.props.tableName,
      session: this.props.session,
      configFormName: this.props.configFormName,
      dataFormName: this.props.dataFormName,
      className: this.props.className,
      onSubmit: this.props.onSubmit,
      reducer: this.props.reducer,
      method: this.props.method,
      addSaveFunction: this.props.addSaveFunction,
      customSave: this.props.customSave,
      addDeleteFunction: this.props.addDeleteFunction,
      addCloseFunction: this.props.addCloseFunction,
      addCustomFunction: this.props.addCustomFunction,
      addCustomButtonName: this.props.addCustomButtonName,
      customSaveButtonName: this.props.customSaveButtonName,
      addDocument: this.props.addDocument,
      uiSchemaConfigMethod: this.props.uiSchemaConfigMethod,
      tableFormDataMethod: this.props.tableFormDataMethod,
      customDependencyDropdownComponent: this.props.customDependencyDropdownComponent,
      ddVerbPath: this.props.ddVerbPath,
      triggerAutoDependentDropdownOnChange: this.props.triggerAutoDependentDropdownOnChange,
      disableInitialDependentDropdown: this.props.disableInitialDependentDropdown,
      hideBtns: this.props.hideBtns,
      dropLinkParams: {},
      saveExecuted: false,
      deleteExecuted: false,
      alert: undefined,
      bypassInputChange: this.props.bypassInputChange, // callback function to fetch (formdata, target-fieldName, target-fieldValue)
      noValidate: this.props.noValidate || false,
      disabled: this.props.disabled
    }
    this.saveObject = this.saveObject.bind(this)
    this.deleteObject = this.deleteObject.bind(this)
    this.windowClose = this.windowClose.bind(this)
    this.onInputChange = this.onInputChange.bind(this)
    this.initiateDeleteAction = this.initiateDeleteAction.bind(this)
    this.alertCloseWithAddedFunc = this.alertCloseWithAddedFunc.bind(this)
    this.transformErrors = this.transformErrors.bind(this)
    this.errorListTemplate = this.errorListTemplate.bind(this)
    this.Widgets = {
      CustomSelectDropdown: this.CustomSelectDropdown.bind(this),
      CustomMultiSelectDropdown: this.CustomMultiSelectDropdown.bind(this),
      CustomDateWithNowButton: this.CustomDateWithNowButton.bind(this),
      GPSCoordinate: this.GPSCoordinate.bind(this),
      DependencyDropdown: this.DependencyDropdown.bind(this),
      DependentValueField: this.DependentValueField.bind(this)
    }
  }

  DependencyDropdown = (elementProps) => {
    const elementId = elementProps.id
    let fieldCode, sectionName
    if (this.state.formData?.type === 'array') {
      // elementId is "root_0_FIELDNAME"; strip "root_{index}_" to get the actual field name
      const withoutRoot = elementId.replace(/^root_/, '')
      fieldCode = withoutRoot.replace(/^\d+_/, '')
      sectionName = findSectionName(this.state.uischema, fieldCode)
    } else {
      const derivedCode = elementId.replace(/^root_/, '')
      if (this.state.uischema?.[derivedCode]) {
        // Flat schema — derive fieldCode directly from element ID so each
        // DependencyDropdown root gets its own correct fieldCode.
        fieldCode = derivedCode
        sectionName = null
      } else {
        // Sectioned schema — field is nested; fall back to findWidget.
        fieldCode = findWidget(this.state.uischema, 'ui:widget', 'DependencyDropdown')
        sectionName = findSectionName(this.state.uischema, fieldCode)
      }
    }
    const hideInternalLabel = !!(this.props.helpSectionId || this.props.helpContextSectionId || hasHelpCode(this.state.uischema))
    const helpCode = elementProps.uiSchema?.['ui:helpCode'] || null
    return (
      <DependencyDropdown
        customDependencyDropdownComponent={this.state.customDependencyDropdownComponent}
        isSearchForm={this.props.isSearchForm}
        formInstance={this}
        formId={this.state.id}
        formSchema={this.state.uischema}
        formConfig={this.state.formData}
        formData={this.state.formTableData}
        elementId={elementId}
        sectionName={sectionName}
        fieldCode={fieldCode}
        tableName={this.state.tableName}
        ddVerbPath={this.state.ddVerbPath}
        triggerAutoDependentDropdownOnChange={this.state.triggerAutoDependentDropdownOnChange}
        disableInitialDependentDropdown={this.state.disableInitialDependentDropdown}
        spread='right'
        hideInternalLabel={hideInternalLabel}
        helpCode={helpCode}
      />
    )
  }

  DependentValueField = (elementProps) => {
    const elementId = elementProps.id
    const isArray = this.state.formData?.type === 'array'
    const withoutRoot = elementId.replace(/^root_/, '')
    const fieldCode = isArray ? withoutRoot.replace(/^\d+_/, '') : withoutRoot
    const fieldSchema = isArray ? this.state.uischema?.items?.[fieldCode] : this.state.uischema?.[fieldCode]
    const { dependentOnField, codelistName } = fieldSchema || {}

    return (
      <DependentValueField
        {...elementProps}
        formId={this.state.id}
        dependentOnField={dependentOnField}
        codelistName={codelistName}
        attributeName={fieldCode}
        arrayIndex={isArray ? parseInt(getArrayIndexFromElementId(elementId)) : undefined}
      />
    )
  }

  GPSCoordinate = props => {
    const { formTableData } = this.props
    const { value, name, readonly, disabled, autofocus, onBlur, onFocus, ...inputProps } = props;
    const defaultValue = `${'00'}°${'00'}'${'00'}''`

    const pad = string => {
      const dataArr = Array.from(string).filter(c => '0123456789'.split('').includes(c))
      const len = dataArr.length

      return len >= 2 ? dataArr.slice(0, 2).join('') : dataArr.join('') + new Array(2 - len + 1).join('0')
    }

    const format = string => {
      let dmsArr = string.split(/[°']/).slice(0, 3)
      let d = pad(dmsArr[0])
      let m = pad(dmsArr[1])
      let s = pad(dmsArr[2])

      return `${d}°${m}'${s}''`
    }

    const setCursorPosition = ({ target }) => {
      const _c = target.selectionStart
      const dLen = defaultValue.length
      const tLen = target.value.length

      const skipSymbol = i => {
        if ([2, 5].includes(i)) {
          return i + 1
        } else if (i === 8) {
          return i + 2
        }
        return i
      }

      window.requestAnimationFrame(() => {
        target.selectionStart = dLen < tLen ? skipSymbol(_c) : _c
        target.selectionEnd = dLen < tLen ? skipSymbol(_c) : _c
      })
    }

    const _onChange = e => {
      setCursorPosition(e)
      e.preventDefault()

      return props.onChange(format(e.target.value))
    }

    let inputValue = value === undefined || value === null ? defaultValue : value
    const formDataValue = getObjectValueByKey(formTableData, name)
    if (formDataValue && !inputValue) {
      inputValue = formDataValue
    }

    return <input
      className='form-control'
      type='text'
      readOnly={readonly}
      disabled={disabled}
      autoFocus={autofocus}
      value={inputValue}
      {...inputProps}
      onChange={_onChange}
      onBlur={onBlur && (event => onBlur(inputProps.id, event.target.value))}
      onFocus={onFocus && (event => onFocus(inputProps.id, event.target.value))}
      onSelectCapture={e => (e.target.selectionEnd = e.target.selectionStart)}
    />
  }

  CustomDateWithNowButton = (props) => {
    const { registry } = props;
    const { widgets } = registry;

    const setCurrentDate = (e) => {
      e.preventDefault()
      const currentDate = new Date().toISOString().substr(0, 19).split('T')[0]
      return props.onChange(currentDate)
    }

    return (
      <div id={props.id + 'CustomDateWithNowButton'} className='custom-date'>
        {widgets.DateWidget(props)}
        <button type='button' onClick={setCurrentDate} className='btn-success btn_save_form custom-date-btn'>
          {
            this.context.intl.formatMessage(
              {
                id: `${labelBasePath}.main.now`,
                defaultMessage: `${labelBasePath}.main.now`
              }
            )
          }
        </button>
      </div>

    )
  }

  CustomSelectDropdown = (props) => {
    const { options } = props;
    const { enumOptions } = options;
    const filterOptions = createFilterOptions({
      options: enumOptions
    })
    return (
      <div key={props.id + 'customDropdown'} >
        <Select
          className='custom-select-dropdown'
          clearable={false}
          optionClassName='custom-select-dropdown-options'
          filterOptions={filterOptions}
          options={enumOptions}
          onChange={(event) => props.onChange(event.value)}
          value={props.value}
          required={props.required}
        />
      </div>
    )
  }

  CustomMultiSelectDropdown = (props) => {
    const { options } = props;
    const { enumOptions } = options;
    const filterOptions = createFilterOptions({
      options: enumOptions
    })
    if (props.value) {
      if (props.value.constructor === Array) {
        props.onChange(props.value.join())
      }
    } else {
      props.onChange('')
    }
    return (
      <div key={props.id + 'customMultiDropdown'} >
        <Select
          filterOptions={filterOptions}
          className='custom-multi-select-dropdown'
          multi
          simpleValue
          removeSelected
          optionClassName='custom-select-dropdown-options'
          options={enumOptions}
          onChange={(event) => props.onChange(event)}
          value={props.value}
          required={props.required}
        />
      </div>
    )
  }

  /* get config data for forms. */
  componentDidMount() {
    getFormData(this.state.id, 'FORM', this.state.method, this.state.uiSchemaConfigMethod, this.state.tableFormDataMethod, this.state.session, this.props.params)
  }

  componentDidUpdate() {
    this.props.refFunction(this)
  }

  alertCloseWithAddedFunc() {
    if (this.props.onAlertClose && this.props.onAlertClose instanceof Function) {
      this.setState({ saveExecuted: false, deleteExecuted: false })
      this.props.onAlertClose()
    } else {
      this.windowClose()
    }
  }

  alertCloseWithoutFormClose = () => {
    if (this.props.onAlertClose && this.props.onAlertClose instanceof Function) {
      this.setState({ saveExecuted: false, deleteExecuted: false })
    } else {
      this.windowClose()
    }
  }

  removeFormFields = (nextProps) => {
    if (nextProps.enableExcludedFields && nextProps.formWithExcluded && nextProps.formWithExcluded.properties && nextProps.formFieldsToBeEcluded) {
      nextProps.formFieldsToBeEcluded.map((e) => {
        if (nextProps.formWithExcluded.properties[e]) {
          delete nextProps.formWithExcluded.properties[e]
        }
      })
      this.forceUpdate()
    }
  }
  // transform json schema forms with labels
  transformFormDataToLabels = () => {
    // change tile props to labels
    // if (nextProps.formData && nextProps.formData.properties) {
    //   // uncoment to copy labels from dev console using copy(temp1)
    //   /* let labelsToDevConsole = */ Object.entries(nextProps.formData.properties).map((e) => {
    //     // return [`${labelBasePath}.form_labels.${e[0].toLowerCase()}=${e[1].title}`]
    //     nextProps.formData.properties[e[0]].title = this.context.intl.formatMessage({
    //       id: `${labelBasePath}.form_labels.${e[0].toLowerCase()}`,
    //       defaultMessage: `${labelBasePath}.form_labels.${e[0].toLowerCase()}`
    //     })
    //   })
    //   // console.log(labelsToDevConsole)
    // }
    // if (nextProps.enableExcludedFields && nextProps.formWithExcluded && nextProps.formWithExcluded.properties && nextProps.formFieldsToBeEcluded) {
    //   Object.entries(nextProps.formWithExcluded.properties).map((e) => {
    //     nextProps.formWithExcluded.properties[e[0]].title = this.context.intl.formatMessage({
    //       id: `${labelBasePath}.form_labels.${e[0].toLowerCase()}`,
    //       defaultMessage: `${labelBasePath}.form_labels.${e[0].toLowerCase()}`
    //     })
    //   })
    // }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // translate components
    // translateComponents && this.transformFormDataToLabels(nextProps)
    // Remove form fileds from config
    this.removeFormFields(nextProps)
    // Refresh state if new labels are loaded
    if (nextProps.gridLang && (this.props.gridLang !== nextProps.gridLang)) {
      this.forceUpdate()
    }

    for (const key in nextProps) {
      const value = nextProps[key]
      this.setState({ [key]: value })
    }

    const nextSchema = nextProps.enableExcludedFields ? nextProps.formWithExcluded : nextProps.formData
    const nextFormTableData = 'formTableData' in nextProps ? nextProps.formTableData : this.state.formTableData
    const formTableDataWithDefaults = applySchemaDefaults(nextSchema, nextFormTableData)
    if (formTableDataWithDefaults !== nextFormTableData) {
      this.setState({ formTableData: formTableDataWithDefaults })
    }

    if (this.state.dataFormName !== nextProps.dataFormName || this.state.configFormName !== nextProps.configFormName ||
      this.state.params !== nextProps.params) {
      getFormData(
        nextProps.id, 'FORM', nextProps.method, nextProps.uiSchemaConfigMethod, nextProps.tableFormDataMethod,
        nextProps.session, nextProps.params
      )
    }

    if ((this.props.formConfigLoaded !== nextProps.formConfigLoaded || this.props.formData !== nextProps.formData) && nextProps.formConfigLoaded === false) {
      alertUserResponse({ response: nextProps.formData?.response })
    }

    if ((this.props.uischemaLoaded !== nextProps.uischemaLoaded || this.props.uischema !== nextProps.uischema) && nextProps.uischemaLoaded === false) {
      alertUserResponse({ response: nextProps.uischema?.response })
    }

    if ((this.props.formDataLoaded !== nextProps.formDataLoaded || this.props.formTableData !== nextProps.formTableData) && nextProps.formDataLoaded === false) {
      alertUserResponse({ response: nextProps.formTableData?.response })
    }

    if (this.props.uischema !== nextProps.uischema) {
      if (isValidObject(nextProps.uischema, 1)) {
        const whereIsMyWidget = findWidget(nextProps.uischema, 'ui:widget', 'CustomMultiSelectDropdown')
        if (whereIsMyWidget) {
          this.setState({
            noValidate: true
          })
        }
      }
    }
  }

  saveObject(formData) {
    const { hideBtns } = this.state
    if (!this.props.buttonsArray && (hideBtns === 'all' || hideBtns === true)) {
      return null;
    }

    let saved = false
    // check if all dependecy dropdowns have values
    // const fieldCode = findWidget(formData.uiSchema, 'ui:widget', 'DependencyDropdown')
    // const sectionName = findSectionName(formData.uiSchema, fieldCode)
    // const dataSection = formData.formData[sectionName]
    // if (fieldCode) {
    // Check primary dep ddl value
    // if (!dataSection[fieldCode]) {
    //   const el = document.getElementById(`root_${sectionName}_${fieldCode}`)
    //   el.onchange = function () {
    //     el.style.border = ''
    //   }
    //   el.style.border = '1px solid #d9230f'
    //   return
    // }
    //   // Check for other dep ddl values that may be missing
    //   for (const field in dataSection) {
    //     if (dataSection.hasOwnProperty(field)) {
    //       if (formData.uiSchema[sectionName][field] &&
    //         formData.uiSchema[sectionName][field].dependentOn &&
    //         !dataSection[field]) {
    //         const el = document.getElementById(`root_${sectionName}_${field}`)
    //         el.onchange = function () {
    //           el.style.border = ''
    //         }
    //         el.style.border = '1px solid #d9230f'
    //         return
    //       }
    //     }
    //   }
    // }

    /* if flag customSave = true then escape default save  */
    if (this.state.customSave) {
      this.state.addSaveFunction(formData, this)
    } else {

      this.setState({ saveExecuted: true })

      if (this.state.addSaveFunction !== null && this.state.addSaveFunction !== undefined) {
        this.state.addSaveFunction(formData, this)
      } else {
        // calls default save if no function has been received as prop
        let defaultSaveParams = this.props.params
        defaultSaveParams = defaultSaveParams.filter(item => item.PARAM_NAME !== 'jsonString')
        defaultSaveParams.push({
          PARAM_NAME: 'jsonString',
          PARAM_VALUE: JSON.stringify(formData.formData)
        })
        for (let i = 0; i < defaultSaveParams.length; i++) {
          if (defaultSaveParams[i].PARAM_NAME === 'link_name' && defaultSaveParams[i].PARAM_VALUE) {
            saveFormData(this.state.id, 'SAVE_OBJECT_WITH_LINK', this.state.session, defaultSaveParams)
            saved = true
          }
        }
        if (!saved) {
          saveFormData(this.state.id, 'SAVE_TABLE_OBJECT', this.state.session, defaultSaveParams)
        }
      }
    }
  }

  initiateDeleteAction() {
    if (this.state.params !== 'READ_URL' && this.state.params !== 'FORM_DATA') {
      this.prepDropLinkParams()
    }

    const title = this.context.intl.formatMessage({ id: `${labelBasePath}.main.delete_record_prompt_title`, defaultMessage: `${labelBasePath}.main.delete_record_prompt_title` })
    const message = this.context.intl.formatMessage({ id: `${labelBasePath}.main.delete_record_prompt_message`, defaultMessage: `${labelBasePath}.main.delete_record_prompt_message` })
    const confirm = this.context.intl.formatMessage({ id: `${labelBasePath}.main.forms.delete`, defaultMessage: `${labelBasePath}.main.forms.delete` })
    const cancel = this.context.intl.formatMessage({ id: `${labelBasePath}.main.forms.cancel`, defaultMessage: `${labelBasePath}.main.forms.cancel` })
    alertUserV2({
      type: 'warning',
      title,
      message,
      confirmButtonText: confirm,
      confirmButtonColor: '#8d230f',
      onConfirm: () => this.setState({ deleteExecuted: true }, this.deleteObjectOrDropLink()),
      showCancel: true,
      cancelButtonText: cancel
    })
  }

  prepDropLinkParams = () => {
    let paramsLength = 0
    if (this.state.params) {
      paramsLength = this.state.params.length
    }
    const dropLinkParams = {}
    if (paramsLength > 0) {
      this.state.params.map(
        paramsElement => {
          if (paramsElement.PARAM_NAME === 'table_name_to_link') {
            dropLinkParams.TABLE = paramsElement.PARAM_VALUE
          }
          if (paramsElement.PARAM_NAME === 'table_name') {
            dropLinkParams.LINKEDTABLE = paramsElement.PARAM_VALUE
          }
          if (paramsElement.PARAM_NAME === 'object_id_to_link') {
            dropLinkParams.OBJECTID1 = paramsElement.PARAM_VALUE
          }
          if (paramsElement.PARAM_NAME === 'object_id') {
            dropLinkParams.OBJECTID2 = paramsElement.PARAM_VALUE
          }
          if (paramsElement.PARAM_NAME === 'link_name') {
            dropLinkParams.LINKNAME = paramsElement.PARAM_VALUE
          }
          if (paramsElement.PARAM_NAME === 'session') {
            dropLinkParams.SESSION = paramsElement.PARAM_VALUE
          }
          if (this.state.id) {
            dropLinkParams.id = this.state.id
          }
        }
      )
    }
  }

  dropLink = () => {
    store.dispatch(dropLinkObjectsAction(this.state.dropLinkParams))
  }

  deleteObject() {
    const params = []
    const currentRecord = this.state.formTableData
    params.push({
      PARAM_NAME: 'session',
      PARAM_VALUE: this.state.session
    }, {
      PARAM_NAME: 'objectId',
      PARAM_VALUE: currentRecord.OBJECT_ID
    }, {
      PARAM_NAME: 'objectType',
      PARAM_VALUE: currentRecord.OBJECT_TYPE
    }, {
      PARAM_NAME: 'objectPkId',
      PARAM_VALUE: currentRecord.PKID
    }, {
      PARAM_NAME: 'jsonString',
      PARAM_VALUE: JSON.stringify(currentRecord)
    })
    /* created customDeleteCallBack to handle closing modal or to extend logic of delete action */
    if (this.state.addDeleteFunction) {
      this.state.addDeleteFunction(this.state.id, 'DELETE_TABLE_OBJECT', this.state.session, params)
    } else {
      saveFormData(this.state.id, 'DELETE_TABLE_OBJECT', this.state.session, params)
    }
  }

  deleteObjectOrDropLink = () => {
    if (Object.keys(this.state.dropLinkParams).length > 1) {
      this.dropLink()
    } else {
      this.deleteObject()
    }
  }

  /* on close button close only popup window. */
  windowClose(data) {
    if (this.state.addCloseFunction && this.state.addCloseFunction instanceof Function) {
      this.state.addCloseFunction(data)
    }
  }

  /* translates errors under field in form */
  transformErrors(errors) {
    return errors.map((error) => {
      if (error.name === "type") {
        error.message = this.context.intl.formatMessage({ id: `${labelBasePath}.error.valid.integer`, defaultMessage: `${labelBasePath}.error.valid.integer` })
      }
      return error
    })
  }

  /* custom error list on top of screen */
  errorListTemplate(props) {
    const { errors } = props;
    return (
      <div>
        {errors.map((error, i) => {
          let msg
          switch (error.params.type) {
            case 'integer':
              msg = this.context.intl.formatMessage({ id: `${labelBasePath}.error.valid.integer`, defaultMessage: `${labelBasePath}.error.valid.integer` });
              break
            case 'date':
              msg = this.context.intl.formatMessage({ id: `${labelBasePath}.error.valid.date`, defaultMessage: `${labelBasePath}.error.valid.date` });
              break
          }
          return (
            <li key={i}>
              {msg}
            </li>
          );
        })}
      </div>
    );
  }

  onFieldChange = (name, fieldData) => {
    if (this.props.bypassInputChange) {
      // global variables
      fieldName = name
      fieldValue = fieldData
    }
  }

  /* Makes form inputs persistent after saving data */
  /* include bypass onChange func to fetch formData, targeted fieldName and fieldValue into local comp. */
  onInputChange(event) {
    if (this.props.bypassInputChange) {
      this.state.bypassInputChange(event.formData, fieldName, fieldValue)
    } else {
      const merged = Array.isArray(event.formData)
        ? event.formData
        : { ...this.state.formTableData, ...event.formData }
      this.setState({ formTableData: merged })
    }
  }

  /* check for existing className for buttons and form
  and add function on submit */
  render() {
    const {
      id, formWithExcluded, enableExcludedFields, saveExecuted, deleteExecuted,
      addCustomButtonName, addCustomFunction, formData, hideBtns, uischema,
      formTableData, alert, customSave, customSaveButtonName
    } = this.state

    let show = false
    if (formData) {
      show = true
    }
    let className = this.state.className
    let classNameBtn = this.state.classNameBtn

    if (!(className)) {
      className = 'form-test'
    }
    if (!(classNameBtn)) {
      classNameBtn = 'btn btn-xs btn-info'
    }

    const formContext = {
      onFieldChange: this.onFieldChange,
      helpSectionId: this.props.helpSectionId,
      fieldHelpIconSize: this.props.fieldHelpIconSize,
      disableHelpButtons: this.props.disableHelpButtons || false
    };

    const loading = <div><Loading /></div>
    let form = <Form
      id={id}
      validator={validator}
      noValidate={this.state.noValidate}
      className={className}
      fields={{ SchemaField: CustomOnchangeFunction }}
      formContext={formContext}
      schema={enableExcludedFields ? (formWithExcluded || {}) : (formData || {})}
      uiSchema={this.props.uiSchemaOverride
        ? Object.assign({}, uischema, ...Object.entries(this.props.uiSchemaOverride).map(([k, v]) => ({
          [k]: Array.isArray(v) ? v : { ...(uischema?.[k] || {}), ...v }
        })))
        : uischema}
      widgets={{ ...this.Widgets, ...(this.props.additionalWidgets || {}) }}
      templates={this.props.templates || ((this.props.helpSectionId || this.props.helpContextSectionId || hasHelpCode(uischema)) ? { FieldTemplate: HelpFieldTemplate } : undefined)}
      formData={formTableData}
      onSubmit={this.saveObject}
      showErrorList={false}
      ErrorList={this.errorListTemplate}
      transformErrors={this.transformErrors}
      onChange={this.onInputChange}
      disabled={this.state.disabled}
    >
      {this.props.FormExtension && show &&
        <div id='extension'>
          {this.props.FormExtension}
        </div>
      }
      {/* <DependencyDropdown /> */}
      {hideBtns !== true &&
        <div id='buttonHolder'>
          <div id='btnSeparator' style={{ width: 'auto', float: 'right' }}>
            {addCustomFunction instanceof Function &&
              <button id='custom_btn_generic_form' type='button' onClick={addCustomFunction} style={{ margin: '0 .5rem', float: 'left' }} className='btn-success btn_save_form'>
                {addCustomButtonName}
              </button>
            }
            {hideBtns !== 'submit' && hideBtns !== 'all' && customSave !== true &&
              <button type='submit' id='save_form_btn' style={{ margin: '0 .5rem' }} className='btn-success btn_save_form'>
                {this.context.intl.formatMessage({ id: `${labelBasePath}.main.forms.save`, defaultMessage: `${labelBasePath}.main.forms.save` })}
              </button>
            }
            {hideBtns !== 'submit' && hideBtns !== 'all' && customSave === true &&
              <button type='submit' id='save_form_btn' style={{ margin: '0 .5rem' }} className='btn-success btn_save_form'>
                {customSaveButtonName}
              </button>
            }
            {hideBtns !== 'close' && hideBtns !== 'closeAndDelete' && hideBtns !== 'all' &&
              <button type='button' id='close_form_btn' style={{ margin: '0 .5rem' }} className='btn btn_close_form' onClick={this.windowClose}>
                {this.context.intl.formatMessage({ id: `${labelBasePath}.main.forms.close`, defaultMessage: `${labelBasePath}.main.forms.close` })}
              </button>
            }
          </div>
          {hideBtns !== 'delete' && hideBtns !== 'closeAndDelete' && hideBtns !== 'all' &&
            <button type='button' id='delete_form_btn' className='btn-danger btn_delete_form' onClick={this.initiateDeleteAction}>
              {this.props.customDeleteButtonName ? this.props.customDeleteButtonName : this.context.intl.formatMessage({ id: `${labelBasePath}.main.forms.delete`, defaultMessage: `${labelBasePath}.main.forms.delete` })}
            </button>
          }
          {this.props.buttonsArray && (
            <>
              {this.props.buttonsArray.map((element) => (
                <button
                  type={element.type}
                  key={element.id}
                  id={element.id}
                  className={element.className ? `${element.className}` : 'btn'}
                  onClick={element.action instanceof Function ? element.action : null}
                >
                  {element.label}
                </button>
              ))}
            </>
          )}
        </div>
      }
    </Form>

    if (this.props.inputWrapper && form) {
      form = <this.props.inputWrapper formid={id} formInstance={this}>
        {form}
      </this.props.inputWrapper>
    }

    return (
      <div id='form'>
        {alert}
        {(!show) ? loading : form}
        {(saveExecuted || deleteExecuted) && loading}
      </div>
    )
  }
}

GenericForm.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  gridLang: state.intl.locale
})

const ConnectedGenericForm = connect(mapStateToProps)(GenericForm)
const GenericFormWithHelpContext = (props) => {
  const { sectionId } = React.useContext(HelpContext)
  return <ConnectedGenericForm {...props} helpContextSectionId={sectionId} />
}
export default WrapItUp(GenericFormWithHelpContext, 'GenericForm', undefined, false)
