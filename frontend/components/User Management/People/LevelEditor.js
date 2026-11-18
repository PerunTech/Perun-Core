import React, { useEffect, useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse } from '../../../elements'
import GenericGrid from '../../../elements/grid/GenericGrid'
import { getGroupMembers, getGroups, runGroupPlan } from './peopleApi'
import { LEVELS } from './permissionMatrix'
import { lowerPlan, raiseRoutes } from './accessRoutes'
import { useAclData } from './useAclData'
import { sameId } from './people'
import { effectColumns, effectRows, fitHeight } from './grids'
import { Banner, quietSuccess, useLabels } from './ui'

const NAMES_SHOWN = 5

const listNames = (names) => (names.length > NAMES_SHOWN
  ? `${names.slice(0, NAMES_SHOWN).join(', ')} +${names.length - NAMES_SHOWN}`
  : names.join(', '))

// Once a level is picked: the person's groups with their members, and every group's codes.
const useRouteData = (svSession, person, wanted) => {
  const { data, failed: aclFailed } = useAclData(svSession, wanted)
  const [own, setOwn] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!svSession || !wanted || own) return
    let cancelled = false
    getGroups(svSession, person.id).then(async groups => {
      const members = await Promise.all(groups.map(group => getGroupMembers(svSession, group.id)
        .then(people => people.map(each => each.userName)).catch(() => null)))
      if (!cancelled) setOwn({ groups, members: new Map(groups.map((group, i) => [group.name, members[i]])) })
    }).catch(err => {
      if (cancelled) return
      setFailed(true)
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, person.id, wanted, own])

  const base = useMemo(() => (own && data ? { ...own, catalog: data.grantable } : null), [own, data])
  const candidates = useMemo(() => (base
    ? data.groups
      .filter(group => !base.groups.some(mine => sameId(mine.id, group.id)))
      .map(group => ({ ...group, permissions: data.permissionsOf(group.id) }))
    : null), [base, data])
  return { base, candidates, failed: failed || aclFailed }
}

const LevelEditor = ({ svSession, person, row, state, label, prefix, onApplied, initialTarget = null }) => {
  const t = useLabels()
  const [target, setTarget] = useState(initialTarget)
  const [pick, setPick] = useState(null)
  const [choices, setChoices] = useState({})
  const [busy, setBusy] = useState(false)
  const raising = target !== null && target > row.level
  const lowering = target !== null && target < row.level
  const { base, candidates, failed } = useRouteData(svSession, person, target !== null)

  const user = person.userName
  const table = label(row)
  const routes = useMemo(() => {
    if (!raising || !base || !candidates) return null
    return raiseRoutes({ ...base, state, tableId: row.id, level: target, userName: user, candidates })
  }, [raising, base, candidates, state, row.id, target, user])
  const plan = useMemo(() => {
    if (!lowering || !base) return null
    return lowerPlan({ ...base, state, tableId: row.id, level: target, userName: user, choices })
  }, [lowering, base, choices, state, row.id, target, user])
  const selected = routes && (routes.find(route => route.key === pick) || routes[0])
  const chosen = raising ? selected : plan

  const columns = useMemo(() => effectColumns(t), [t])
  const effect = useMemo(() => (chosen ? effectRows(chosen.effect, { tableId: row.id, label }) : []), [chosen, row.id, label])

  const choose = (level) => {
    setTarget(level === row.level || level === target ? null : level)
    setPick(null)
    setChoices({})
  }

  // Busy until the refetched access remounts this editor, so the same steps cannot be sent twice.
  const apply = () => {
    if (!chosen?.steps.length) return
    setBusy(true)
    runGroupPlan(svSession, person.id, chosen.steps)
      .then(() => quietSuccess(t('perun.people.level_done', { table, level: LEVELS[chosen.result], user })))
      .catch(err => alertUserResponse({ response: err }))
      .finally(onApplied)
  }

  const sideText = (side) => (side ? t('perun.people.route_side', { user, count: side }) : t('perun.people.route_no_side', { user }))
  const othersText = (others, group) => {
    if (!others) return t('perun.people.members_unknown', { group })
    if (!others.length) return t('perun.people.route_no_others', { group })
    return t('perun.people.route_others', { group, count: others.length, names: listNames(others) })
  }
  const through = (outcome) => [...outcome.through, ...(outcome.direct ? [t('perun.people.direct_source')] : [])].join(', ')
  const resultText = (outcome) => {
    const level = LEVELS[outcome.result]
    if (!outcome.result) return t('perun.people.result_none')
    if (outcome.result < target) return t('perun.people.result_below', { level, through: through(outcome), target: LEVELS[target] })
    return t('perun.people.result_through', { level, through: through(outcome) })
  }

  const raiseBody = () => {
    if (!routes.length) {
      return <p className='people-note'>{t('perun.people.no_routes', { level: LEVELS[target], table, code: `${row.name}.${LEVELS[target]}` })}</p>
    }
    return (
      <div className='people-routes' role='radiogroup' aria-label={t('perun.people.routes', { level: LEVELS[target], table })}>
        {routes.map((route, index) => {
          const on = route === selected
          const facts = [t('perun.people.route_result', { level: LEVELS[route.result] }), sideText(route.side)]
          if (route.kind === 'raise') facts.push(othersText(route.others, route.group.name))
          return (
            <label key={route.key} className={`people-route${on ? ' on' : ''}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input type='radio' name={`people-route-${row.id}`} checked={on} disabled={busy} onChange={() => setPick(route.key)} />
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span>
                  <b>
                    {route.kind === 'join'
                      ? t('perun.people.route_join', { user, group: route.group.name })
                      : t('perun.people.route_raise', { group: route.group.name, level: LEVELS[target], table })}
                  </b>
                  {index === 0 && routes.length > 1 && <span className='people-chip best' style={{ marginLeft: 8 }}>{t('perun.people.route_best')}</span>}
                </span>
                <span className='people-faint'>{facts.join(' · ')}</span>
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  const lowerBody = () => (
    <>
      {plan.directLevel > 0 && (
        <Banner kind='warn' title={t('perun.people.direct_floor_title')}>
          {t('perun.people.direct_floor_text', { user, level: LEVELS[plan.directLevel] })}
        </Banner>
      )}
      {plan.blockers.map(({ group, level, canLeave, leaveSide, others, choice }) => {
        const name = `people-blocker-${row.id}-${group.id}`
        const set = (value) => setChoices(current => ({ ...current, [String(group.id)]: value }))
        return (
          <div key={group.id} className='people-blocker' role='radiogroup' aria-labelledby={`${name}-title`} style={{ display: 'grid', gap: 4 }}>
            <div id={`${name}-title`} className='people-blocker-title'>
              {t('perun.people.blocker_gives', { group: group.name, level: LEVELS[level] })}
              {group.isDefault && <span className='people-chip default' style={{ marginLeft: 8 }}>{t('perun.people.default')}</span>}
            </div>
            <label className='people-choice' style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input type='radio' name={name} checked={choice === 'leave'} disabled={busy || !canLeave} onChange={() => set('leave')} />
              <span>
                {t('perun.people.route_leave', { user, group: group.name })}
                <span className='people-faint'> · {canLeave ? sideText(leaveSide) : t('perun.people.remove_default_hint')}</span>
              </span>
            </label>
            <label className='people-choice' style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <input type='radio' name={name} checked={choice === 'lower'} disabled={busy} onChange={() => set('lower')} />
              <span>
                {t('perun.people.route_lower', { group: group.name, level: LEVELS[target], table })}
                <span className='people-faint'> · {othersText(others, group.name)}</span>
              </span>
            </label>
          </div>
        )
      })}
    </>
  )

  let body = null
  if (target !== null) {
    if (failed) body = <p className='people-note'>{t('perun.people.routes_failed')}</p>
    else if (!base || (raising && !routes)) body = <p className='people-note'>{t('perun.people.routes_loading')}</p>
    else body = raising ? raiseBody() : lowerBody()
  }

  return (
    <section className='people-level-editor'>
      <h4>{t('perun.people.level_on', { table })}</h4>
      <div className='people-level-picker' role='group' aria-label={t('perun.people.level_on', { table })} style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
        {LEVELS.map((name, level) => (
          <button
            key={name}
            type='button'
            className={`people-level${level === row.level ? ' current' : ''}${level === target ? ' on' : ''}`}
            aria-pressed={level === target}
            aria-current={level === row.level ? 'true' : undefined}
            title={level === row.level ? t('perun.people.current_level') : undefined}
            disabled={busy}
            onClick={() => choose(level)}
          >
            {name}
          </button>
        ))}
      </div>
      {target === null && <p className='people-note'>{t('perun.people.pick_level', { level: LEVELS[row.level] })}</p>}
      {body && (
        <div className='people-routes-panel'>
          {body}
          {chosen && (lowering || routes?.length > 0) && (
            <>
              {lowering && <p className='people-route-result'>{resultText(chosen)}</p>}
              {chosen.side > 0 && (
                <div className='people-effect'>
                  <h5>{t('perun.people.other_changes', { user })}</h5>
                  <GenericGrid
                    key={`${target}:${raising ? chosen.key : JSON.stringify(choices)}`}
                    id={`${prefix}_EFFECT`}
                    gridType='SEARCH_GRID_DATA'
                    configTableName={columns}
                    dataTableName={effect}
                    minHeight={fitHeight(effect.length, 6)}
                  />
                </div>
              )}
              {lowering && !chosen.side && <p className='people-faint'>{sideText(0)}</p>}
            </>
          )}
          {raising && routes?.length > 0 && <p className='people-note'>{t('perun.people.groups_only', { user })}</p>}
          <div className='people-actions' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button type='button' className='people-btn primary' disabled={busy || !chosen?.steps.length} onClick={apply}>
              {t('perun.people.apply')}
            </button>
            <button type='button' className='people-btn ghost' disabled={busy} onClick={() => choose(null)}>
              {t('perun.my_profile.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(LevelEditor)
