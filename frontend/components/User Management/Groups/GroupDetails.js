import React, { useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, GenericForm } from '../../../client'
import { alertUserResponse } from '../../../elements'
import { getDynamicKey } from '../../../functions/utils'
import { saveGroup } from '../People/peopleApi'
import { quietSuccess, useLabels } from '../People/ui'

// The SVAROG_USER_GROUPS form, saved through saveUserGroup; 0 is a new group.
const GroupDetails = ({ svSession, groupId = 0, onSaved, onCancel }) => {
  const t = useLabels()
  const [formId] = useState(() => getDynamicKey())

  const save = (e) => {
    const name = e.formData?.GROUP_NAME
    saveGroup(svSession, e.formData).then(() => {
      quietSuccess(t('perun.groups.details_saved', { group: name }))
      onSaved?.(name)
    }).catch(err => alertUserResponse({ response: err })).finally(() => {
      ComponentManager.setStateForComponent(formId, null, { saveExecuted: false })
    })
  }

  return (
    <div className='people-group-details'>
      {!groupId && (
        <>
          <h3>{t('perun.groups.new')}</h3>
          <p className='people-note'>{t('perun.groups.new_hint')}</p>
        </>
      )}
      <GenericForm
        params='READ_URL'
        key={formId}
        id={formId}
        method={`/ReactElements/getTableJSONSchema/${svSession}/SVAROG_USER_GROUPS`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/SVAROG_USER_GROUPS`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/${groupId}/SVAROG_USER_GROUPS`}
        addSaveFunction={save}
        hideBtns='closeAndDelete'
        className='form-test admin-settings-forms'
        customSaveButtonName={t('perun.admin_console.save')}
        customSave
        helpSectionId='SVAROG_USER_GROUPS'
      />
      {onCancel && (
        <button type='button' className='people-btn ghost' onClick={onCancel}>{t('perun.my_profile.cancel')}</button>
      )}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(GroupDetails)
