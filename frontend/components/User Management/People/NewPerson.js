import React, { useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, GenericForm } from '../../../client'
import { getDynamicKey } from '../../../functions/utils'
import { useLabels } from './ui'
import AddUserWrapper from './AddUserWrapper'

const NewPerson = ({ svSession, onCreated, onCancel }) => {
  const t = useLabels()
  const [formId] = useState(() => getDynamicKey())

  const created = () => {
    const formData = ComponentManager.getStateForComponent(formId, 'formTableData')
    onCreated(formData?.USER_NAME)
  }

  return (
    <article className='people-person people-new'>
      <header className='people-person-head' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div className='people-person-title' style={{ flex: 1, minWidth: 200 }}>
          <h3>{t('perun.people.new')}</h3>
          <p className='people-note'>{t('perun.people.new_hint')}</p>
        </div>
        <button type='button' className='people-btn ghost' onClick={onCancel}>{t('perun.my_profile.cancel')}</button>
      </header>
      <GenericForm
        params='READ_URL'
        key={formId}
        id={formId}
        method={`/ReactElements/getTableJSONSchema/${svSession}/SVAROG_USERS`}
        uiSchemaConfigMethod={`/ReactElements/getTableUISchema/${svSession}/SVAROG_USERS`}
        tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/0/SVAROG_USERS`}
        addSaveFunction={() => {}}
        hideBtns='closeAndDelete'
        className='form-test admin-settings-forms add-user-wrapper'
        inputWrapper={AddUserWrapper}
        afterSaveCleanUp={created}
        customSaveButtonName={t('perun.admin_console.save')}
        customSave
        helpSectionId='SVAROG_USERS'
      />
    </article>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(NewPerson)
