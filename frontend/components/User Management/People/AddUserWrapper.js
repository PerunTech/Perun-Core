import React, { useEffect, useMemo, useRef, useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, Loading, validator } from '../../../client'
import { alertUserResponse, alertUserV2, Select } from '../../../elements'
import { wasReported } from '../../../functions/reportedErrors'
import PasswordForm from '../MyProfile/PasswordForm'
import { createUser, findPerson, getAllGroups, runGroupPlan } from './peopleApi'
import { addableGroups, newUserBody, userFormErrors } from './people'
import { useLabels } from './ui'

// saveUser links no group to an internal user, and without one their plugin calls fail.
const setDefaultGroup = async (svSession, userName, groupId) => {
  const person = await findPerson(svSession, userName)
  if (!person) throw new Error(`${userName} not found`)
  await runGroupPlan(svSession, person.id, [{ op: 'default', groupId }])
}

const AddUserWrapper = ({ svSession, formid, formInstance, children }) => {
  const t = useLabels()
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [groupMissing, setGroupMissing] = useState(false)
  const labelId = `${formid}-default-group`

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getAllGroups(svSession).then(list => {
      if (!cancelled) setGroups(list)
    }).catch(err => {
      if (!cancelled) alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession])

  const options = useMemo(() => addableGroups(groups, []), [groups])

  // The visible save is the password form's, so the user form is checked here. A plain submit event makes rjsf show
  // the errors; requestSubmit would stop at the browser's own check of the required inputs.
  const onSave = (passwords) => {
    const formData = ComponentManager.getStateForComponent(formid, 'formTableData') || {}
    const invalid = userFormErrors(validator, formInstance?.state?.formData, formData).length > 0
    if (invalid) document.getElementById(formid)?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    if (!groupId) setGroupMissing(true)
    if (invalid || !groupId) return
    setLoading(true)
    createUser(svSession, newUserBody(formData, passwords))
      .then(async res => {
        try {
          await setDefaultGroup(svSession, formData.USER_NAME, groupId)
          alertUserResponse({ response: res })
        } catch (err) {
          if (!wasReported(err)) {
            const reason = err?.data?.title || err?.response?.data?.title
            alertUserV2({
              type: 'warning',
              title: t('perun.people.group_not_set'),
              message: reason ? `${t('perun.people.group_not_set_text')} (${reason})` : t('perun.people.group_not_set_text')
            })
          }
        }
        formInstance?.props?.afterSaveCleanUp?.()
      })
      .catch(err => alertUserResponse({ response: err, type: 'error' }))
      .finally(() => setLoading(false))
  }
  // GenericForm keeps the save function of its first render.
  const latestSave = useRef(onSave)
  latestSave.current = onSave

  return (
    <>
      {loading && <Loading />}
      {children}
      <fieldset
        className='people-new-group'
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', columnGap: 20, minWidth: 0, margin: '24px 0 0', padding: 0, border: 0 }}
      >
        <legend>{t('perun.people.new_group')}</legend>
        <div className={`form-group field field-string${groupMissing ? ' has-error' : ''}`}>
          <div className='admin-console-field-label-row'>
            <label className='control-label' id={labelId}>
              {t('perun.people.default_group')}<span className='required'>*</span>
            </label>
          </div>
          <Select
            options={options}
            value={groupId}
            simpleValue
            clearable={false}
            required
            onChange={value => {
              setGroupId(value || '')
              setGroupMissing(false)
            }}
            placeholder={t('perun.people.pick_group')}
            aria-labelledby={labelId}
          />
          {groupMissing && <ul className='error-detail'><li className='text-danger'>{t('perun.people.default_group_missing')}</li></ul>}
        </div>
      </fieldset>
      <PasswordForm svSession={svSession} isNewUser={true} onSave={(passwords) => latestSave.current(passwords)} />
    </>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(AddUserWrapper)
