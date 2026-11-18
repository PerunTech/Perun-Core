import React, { useEffect, useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse } from '../../../elements'
import GenericGrid from '../../../elements/grid/GenericGrid'
import { getGroups, runGroupPlan } from '../People/peopleApi'
import { effectColumns, effectRows, fitHeight } from '../People/grids'
import { quietSuccess, useLabels } from '../People/ui'
import { codeRoutes } from './accessCheck'

// The groups that would give a missing code, each with what else joining it changes for the person.
const CodeFix = ({ svSession, person, state, aclId, code, data, label, prefix, onApplied }) => {
  const t = useLabels()
  const [groups, setGroups] = useState(null)
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  const user = person.userName

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getGroups(svSession, person.id).then(list => {
      if (!cancelled) setGroups(list)
    }).catch(err => {
      if (cancelled) return
      setGroups([])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, person.id])

  const routes = useMemo(() => (groups
    ? codeRoutes({
      state,
      aclId,
      groups,
      candidates: data.groups.map(group => ({ ...group, permissions: data.permissionsOf(group.id) }))
    })
    : null), [groups, state, aclId, data])
  const selected = routes && (routes.find(route => route.key === pick) || routes[0])
  const columns = useMemo(() => effectColumns(t), [t])
  const rows = useMemo(() => (selected ? effectRows(selected.effect, { label }) : []), [selected, label])

  // Busy until the refetched access remounts this, so the same step cannot be sent twice.
  const apply = () => {
    setBusy(true)
    runGroupPlan(svSession, person.id, selected.steps)
      .then(() => quietSuccess(t('perun.people.add_done', { user, group: selected.group.name })))
      .catch(err => alertUserResponse({ response: err }))
      .finally(onApplied)
  }

  const sideText = (side) => (side ? t('perun.people.route_side', { user, count: side }) : t('perun.people.route_no_side', { user }))

  let body
  if (!routes) body = <p className='people-note'>{t('perun.people.routes_loading')}</p>
  else if (!routes.length) body = <p className='people-note'>{t('perun.check.no_code_routes', { code })}</p>
  else {
    body = (
      <>
        <div className='people-routes' role='radiogroup' aria-label={t('perun.check.fix_code', { user, code })}>
          {routes.map((route, index) => (
            <label key={route.key} className={`people-route${route === selected ? ' on' : ''}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input type='radio' name={`${prefix}-code-route`} checked={route === selected} disabled={busy} onChange={() => setPick(route.key)} />
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span>
                  <b>{t('perun.people.route_join', { user, group: route.group.name })}</b>
                  {index === 0 && routes.length > 1 && <span className='people-chip best' style={{ marginLeft: 8 }}>{t('perun.people.route_best')}</span>}
                </span>
                <span className='people-faint'>{sideText(route.side)}</span>
              </span>
            </label>
          ))}
        </div>
        {selected.side > 0 && (
          <div className='people-effect'>
            <h5>{t('perun.people.other_changes', { user })}</h5>
            <GenericGrid
              key={selected.key}
              id={`${prefix}_CODE_EFFECT`}
              gridType='SEARCH_GRID_DATA'
              configTableName={columns}
              dataTableName={rows}
              minHeight={fitHeight(rows.length, 6)}
            />
          </div>
        )}
        <div className='people-actions' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button type='button' className='people-btn primary' disabled={busy} onClick={apply}>{t('perun.people.apply')}</button>
        </div>
      </>
    )
  }

  return (
    <section className='people-level-editor people-code-fix'>
      <h4>{t('perun.check.fix_code', { user, code })}</h4>
      <div className='people-routes-panel'>{body}</div>
    </section>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(CodeFix)
