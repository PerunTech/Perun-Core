import React, { useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse } from '../../../elements'
import { setStatus } from './peopleApi'
import { fullName, initials, isActive, isExternal, sameId } from './people'
import { InlineConfirm, quietSuccess, useLabels } from './ui'
import PersonAccess from './PersonAccess'
import PersonGroups from './PersonGroups'
import PersonProfile from './PersonProfile'
import PersonLinks from './PersonLinks'

const TABS = [
  ['access', 'perun.people.tab_access'],
  ['groups', 'perun.people.tab_groups'],
  ['profile', 'perun.people.tab_profile'],
  ['links', 'perun.people.tab_links']
]

const PersonPage = ({ svSession, userObjectId, person, tab, navigate, onChange, onSaved }) => {
  const t = useLabels()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const current = TABS.some(([key]) => key === tab) ? tab : 'access'
  const active = isActive(person)
  const external = isExternal(person)
  const self = sameId(person.id, userObjectId)

  const changeStatus = () => {
    const next = active ? 'INVALID' : 'VALID'
    setBusy(true)
    setStatus(svSession, person.id, next).then(() => {
      setConfirming(false)
      onChange({ ...person, status: next })
      quietSuccess(t(next === 'VALID' ? 'perun.people.enabled_done' : 'perun.people.disabled_done', { user: person.userName }))
    }).catch(err => alertUserResponse({ response: err })).finally(() => setBusy(false))
  }

  const switchHint = external ? t('perun.people.status_external') : self ? t('perun.people.status_self') : undefined

  return (
    <article className='people-person'>
      <header className='people-person-head' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span className='people-avatar large' aria-hidden='true'>{initials(person)}</span>
        <div className='people-person-title' style={{ flex: 1, minWidth: 200 }}>
          <h3>{fullName(person)}</h3>
          <div className='people-person-meta' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <code>{person.userName}</code>
            {person.type && <span className='people-chip'>{person.type}</span>}
            {person.email && <span>{person.email}</span>}
          </div>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={active}
          className={`people-switch${active ? ' on' : ''}`}
          disabled={external || self || busy}
          title={switchHint}
          onClick={() => setConfirming(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span className='people-switch-track' aria-hidden='true'><span className='people-switch-knob' /></span>
          <span>{t(active ? 'perun.people.active' : 'perun.people.disabled')}</span>
        </button>
      </header>
      {switchHint && <p className='people-note'>{switchHint}</p>}
      {confirming && (
        <InlineConfirm
          message={t(active ? 'perun.people.disable_confirm' : 'perun.people.enable_confirm', { user: person.userName })}
          confirmLabel={t(active ? 'perun.people.disable' : 'perun.people.enable')}
          danger={active}
          busy={busy}
          onConfirm={changeStatus}
          onCancel={() => setConfirming(false)}
        />
      )}
      <div className='people-tabs' role='tablist' style={{ display: 'flex', flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={current === key}
            className={`people-tab${current === key ? ' on' : ''}`}
            onClick={() => navigate(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className='people-tab-body' role='tabpanel'>
        {current === 'access' && <PersonAccess person={person} />}
        {current === 'groups' && <PersonGroups person={person} self={self} />}
        {current === 'profile' && <PersonProfile person={person} onSaved={onSaved} />}
        {current === 'links' && <PersonLinks person={person} />}
      </div>
    </article>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
  userObjectId: state.userInfo.userObjectId,
})

export default connect(mapStateToProps)(PersonPage)
