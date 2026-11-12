import React from 'react';
import GenericForm from './GenericForm'

export default class FormManager extends React.Component {
  static generateForm(
    id, configFormName, params, reducer, method, uiSchemaConfigMethod, tableFormDataMethod,
    addCloseFunction, addSaveFunction, addCustomFunction, addCustomButtonName,
    className, classNameBtn, hideBtns, onAlertClose, confirmButtonColor,
    enableExcludedFields, formFieldsToBeEcluded, inputWrapper, FormExtension, customSave, bypassInputChange
  ) {
    // inputWrapper: a component wrapping the form's fields; FormExtension: one rendering extra fields.
    const customForm = (<GenericForm
      id={id}
      configFormName={configFormName}
      params={params}
      reducer={reducer}
      method={method}
      uiSchemaConfigMethod={uiSchemaConfigMethod}
      tableFormDataMethod={tableFormDataMethod}
      addCloseFunction={addCloseFunction}
      addSaveFunction={addSaveFunction}
      customSave={customSave}
      addCustomFunction={addCustomFunction}
      addCustomButtonName={addCustomButtonName}
      className={className}
      classNameBtn={classNameBtn}
      hideBtns={hideBtns}
      onAlertClose={onAlertClose}
      confirmButtonColor={confirmButtonColor}
      enableExcludedFields={enableExcludedFields}
      formFieldsToBeEcluded={formFieldsToBeEcluded}
      inputWrapper={inputWrapper}
      FormExtension={FormExtension}
      bypassInputChange={bypassInputChange}
    />)
    return customForm
  }
}
