import React, { useEffect, useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse, Select } from '../../../elements'
import GenericGrid from '../../../elements/grid/GenericGrid'
import { getDynamicKey } from '../../../functions/utils'
import { getAllGroups, getGroups, runGroupPlan } from './peopleApi'
import { addableGroups, makeDefaultPlan, sameId, sortGroups } from './people'
import { GroupActionsContext, fitHeight, groupColumns, groupRows } from './grids'
import { Banner, InlineConfirm, quietSuccess, useLabels } from './ui'

const PersonGroups = ({ svSession, person, self }) => {
  const t = useLabels()
  const [groups, setGroups] = useState(undefined)
  const [allGroups, setAllGroups] = useState([])
  const [reload, setReload] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState('')
  const [prefix] = useState(() => getDynamicKey())

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    Promise.all([getGroups(svSession, person.id), getAllGroups(svSession)]).then(([own, all]) => {
      if (cancelled) return
      setGroups(sortGroups(own))
      setAllGroups(all)
    }).catch(err => {
      if (cancelled) return
      setGroups(current => current || [])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, person.id, reload])

  const run = (plan, done) => {
    setBusy(true)
    runGroupPlan(svSession, person.id, plan).then(() => quietSuccess(done))
      .catch(err => alertUserResponse({ response: err }))
      .finally(() => {
        setBusy(false)
        setConfirm(null)
        setReload(count => count + 1)
      })
  }

  const columns = useMemo(() => groupColumns(t), [t])
  const rows = useMemo(() => groupRows(groups || []), [groups])
  const actions = useMemo(() => ({ busy, self, ask: (op, id) => setConfirm({ op, id }) }), [busy, self])

  if (!groups) return <p className='people-empty'>{t('perun.people.loading')}</p>

  const current = groups.find(group => group.isDefault)
  const options = addableGroups(allGroups, groups)
  const values = { user: person.userName }

  const target = confirm && groups.find(group => sameId(group.id, confirm.id))
  const confirmation = () => {
    if (!target) return null
    const named = { ...values, group: target.name, previous: current?.name }
    if (confirm.op === 'default') {
      return (
        <InlineConfirm
          message={t(current ? 'perun.people.default_confirm' : 'perun.people.default_confirm_first', named)}
          confirmLabel={t('perun.people.make_default')}
          busy={busy}
          onConfirm={() => run(makeDefaultPlan(groups, target.id), t('perun.people.default_done', named))}
          onCancel={() => setConfirm(null)}
        />
      )
    }
    return (
      <InlineConfirm
        message={t('perun.people.remove_confirm', named)}
        confirmLabel={t('perun.admin_console.remove')}
        danger
        busy={busy}
        onConfirm={() => run([{ op: 'remove', groupId: target.id }], t('perun.people.remove_done', named))}
        onCancel={() => setConfirm(null)}
      />
    )
  }

  const addGroup = () => {
    const picked = options.find(option => option.value === adding)
    if (!picked) return
    setAdding('')
    run([{ op: 'add', groupId: picked.value }], t('perun.people.add_done', { ...values, group: picked.label }))
  }

  return (
    <div className='people-groups-tab'>
      {!groups.length && <Banner title={t('perun.people.no_groups_title')}>{t('perun.people.no_groups_text')}</Banner>}
      {groups.length > 0 && !current && <Banner kind='warn' title={t('perun.people.no_default_title')}>{t('perun.people.no_default_text')}</Banner>}
      {self && <p className='people-note'>{t('perun.people.self_default')}</p>}
      <GroupActionsContext.Provider value={actions}>
        <GenericGrid
          id={`${prefix}_GROUPS`}
          gridType='SEARCH_GRID_DATA'
          configTableName={columns}
          dataTableName={rows}
          minHeight={fitHeight(rows.length)}
        />
      </GroupActionsContext.Provider>
      {confirmation()}
      <div className='people-add-group' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <Select
            options={options}
            value={adding}
            simpleValue
            onChange={value => setAdding(value || '')}
            placeholder={t('perun.people.pick_group')}
            noResultsText={t('perun.people.no_more_groups')}
            aria-label={t('perun.people.pick_group')}
          />
        </div>
        <button type='button' className='people-btn primary' disabled={busy || !adding} onClick={addGroup}>
          {t('perun.people.add_group')}
        </button>
      </div>
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(PersonGroups)
