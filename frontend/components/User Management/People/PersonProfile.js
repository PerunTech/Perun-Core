import React, { useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, GenericForm } from '../../../client'
import { alertUserResponse } from '../../../elements'
import { getDynamicKey } from '../../../functions/utils'
import { editPerson } from './peopleApi'
import { quietSuccess, useLabels } from './ui'
import EditUserWrapper from './EditUserWrapper'

const PersonProfile = ({ svSession, person, onSaved }) => {
  const t = useLabels()
  const [formId] = useState(() => getDynamicKey())

  const save = (e) => {
    editPerson(svSession, person.id, e.formData).then(() => {
      quietSuccess(t('perun.people.profile_saved', { user: person.userName }))
      onSaved()
    }).catch(err => alertUserResponse({ response: err })).finally(() => {
      ComponentManager.setStateForComponent(formId, null, { saveExecuted: false })
    })
  }

  return (
    <GenericForm
      params='READ_URL'
      key={formId}
      id={formId}
      method={`/ReactElements/getTableJSONSchema/${svSession}/SVAROG_USERS`}
      uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/SVAROG_USERS`}
      tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${person.id}/SVAROG_USERS`}
      addSaveFunction={save}
      hideBtns='closeAndDelete'
      className='form-test admin-settings-forms edit-user-wrapper'
      inputWrapper={EditUserWrapper}
      customSaveButtonName={t('perun.admin_console.save')}
      customSave
      helpSectionId='SVAROG_USERS'
    />
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(PersonProfile)
