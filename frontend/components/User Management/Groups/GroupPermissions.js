import React, { useEffect, useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { alertUserResponse, ExportableGrid, Select } from '../../../elements'
import GenericGrid from '../../../elements/grid/GenericGrid'
import { getDynamicKey } from '../../../functions/utils'
import { fetchInBatches } from '../../AdminConsole/SvarogTables/svarogTableUtils'
import { getAccess, getGroupMembers, runGroupEdit } from '../People/peopleApi'
import { LEVELS, tableLabel } from '../People/permissionMatrix'
import { accessState } from '../People/accessRoutes'
import { isAmbiguous } from '../People/aclCatalog'
import { sameId, sortPeople } from '../People/people'
import { effectColumns, effectRows, fitHeight, withAside } from '../People/grids'
import { Banner, quietSuccess, useLabels } from '../People/ui'
import { uniqueMembers } from './GroupMembers'
import {
  effectSummary, emptyEdits, groupLevels, levelCode, memberEffects, planGroupEdit, pruneEdits
} from './groupEdits'
import {
  CodeActionsContext, GROUP_CODES, GROUP_LEVELS, GROUP_REACH, codeColumns, codeRows, levelColumns, levelRows,
  pendingRows, reachColumns, reachRows
} from './groupGrids'

const BATCH = 6
// Above this many members, their access is read only when asked for.
const LARGE = 30
const ADMINISTRATORS = 'ADMINISTRATORS'

const key = (id) => String(id)
const fileSafe = (text) => String(text).replace(/[^\w-]/g, '_')

const GroupPermissions = ({ svSession, group, acl }) => {
  const t = useLabels()
  const { messages } = useIntl()
  const [prefix] = useState(() => getDynamicKey())
  const [edits, setEdits] = useState(emptyEdits)
  const [picked, setPicked] = useState(null)
  const [onlySet, setOnlySet] = useState(true)
  const [showSystem, setShowSystem] = useState(false)
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState(undefined)
  const [loaded, setLoaded] = useState(() => new Map())
  const [loadAll, setLoadAll] = useState(false)
  const [viewing, setViewing] = useState(null)
  const { data } = acl

  const label = useMemo(() => (row) => tableLabel(row, messages), [messages])
  const acls = useMemo(() => (data ? data.permissionsOf(group.id) : []), [data, group.id])
  const levels = useMemo(() => groupLevels(acls), [acls])
  const plan = useMemo(() => (data ? planGroupEdit({ acls, tables: data.tables, index: data.index, edits }) : null), [data, acls, edits])
  const staged = Boolean(plan && !plan.empty)

  // A reload after a save: what went through drops out of the edits, and the buttons come back.
  useEffect(() => {
    setEdits(current => pruneEdits(current, acls))
    setBusy(false)
  }, [acls])
  useEffect(() => {
    if (acl.failed) setBusy(false)
  }, [acl.failed])

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getGroupMembers(svSession, group.id).then(list => {
      if (!cancelled) setMembers(sortPeople(uniqueMembers(list)))
    }).catch(err => {
      if (cancelled) return
      setMembers([])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, group.id])

  const wanted = staged && members?.length > 0 && (members.length <= LARGE || loadAll)
  useEffect(() => {
    if (!svSession || !wanted) return
    const missing = members.filter(person => !loaded.has(key(person.id)))
    if (!missing.length) return
    let cancelled = false
    fetchInBatches(missing, BATCH, person => getAccess(svSession, person.id).then(accessState).catch(() => null))
      .then(states => {
        if (cancelled) return
        setLoaded(current => {
          const next = new Map(current)
          missing.forEach((person, i) => next.set(key(person.id), states[i]))
          return next
        })
      })
    return () => { cancelled = true }
  }, [svSession, wanted, members, loaded])

  const tables = useMemo(() => data?.tables || [], [data])
  const tableNames = useMemo(() => new Map(tables.map(table => [key(table.id), table.name])), [tables])
  const scoped = useMemo(() => {
    const counts = new Map()
    acls.filter(own => own.configKey && key(own.resourceId) !== '0')
      .forEach(own => counts.set(key(own.resourceId), (counts.get(key(own.resourceId)) || 0) + 1))
    return counts
  }, [acls])
  const visible = useMemo(() => tables.filter(table => (showSystem || !table.system) &&
    (!onlySet || (levels.get(key(table.id)) ?? 0) > 0 || scoped.has(key(table.id)))), [tables, showSystem, onlySet, levels, scoped])
  const levelCols = useMemo(() => levelColumns(t), [t])
  const levelData = useMemo(() => levelRows(visible, { levels, scoped, label }), [visible, levels, scoped, label])

  const heldOther = useMemo(() => (data
    ? acls.map(own => data.index.byId.get(key(own.aclId))).filter(entry => entry && entry.kind !== 'table')
    : []), [data, acls])
  const granting = useMemo(() => (data ? edits.grant.map(id => data.index.byId.get(key(id))).filter(Boolean) : []), [data, edits.grant])
  const codeCols = useMemo(() => codeColumns(t), [t])
  const codeData = useMemo(() => codeRows({
    held: heldOther, granting, revoking: new Set(edits.revoke), tableName: id => tableNames.get(key(id)) || '', t
  }), [heldOther, granting, edits.revoke, tableNames, t])
  const codeActions = useMemo(() => ({
    busy,
    revoke: (row) => setEdits(current => ({ ...current, revoke: [...current.revoke, row[`${GROUP_CODES}.LABEL_CODE`]] })),
    undo: (row) => setEdits(current => (row[`${GROUP_CODES}.CHANGE_KEY`] === 'grant'
      ? { ...current, grant: current.grant.filter(id => !sameId(id, row[`${GROUP_CODES}.ACL_ID`])) }
      : { ...current, revoke: current.revoke.filter(code => code !== row[`${GROUP_CODES}.LABEL_CODE`]) }))
  }), [busy])

  // Svarog skips a grant whose label the group holds already, and picks at random between rows sharing a label.
  const { grantOptions, leftOut } = useMemo(() => {
    if (!data) return { grantOptions: [], leftOut: 0 }
    const heldLabels = new Set(acls.map(own => own.labelCode))
    const free = data.acls.filter(entry => entry.kind !== 'table' && !heldLabels.has(entry.labelCode) &&
      !edits.grant.some(id => sameId(id, entry.aclId)))
    const options = free.filter(entry => !isAmbiguous(data.index, entry.labelCode)).map(entry => ({
      value: key(entry.aclId),
      label: `${withAside(entry.labelCode, entry.configKey)}${entry.kind === 'scoped' ? ` · ${tableNames.get(key(entry.resourceId)) || ''}` : ''}`
    })).sort((a, b) => a.label.localeCompare(b.label))
    return { grantOptions: options, leftOut: free.length - options.length }
  }, [data, acls, edits.grant, tableNames])

  const pending = useMemo(() => (staged ? pendingRows(plan, label) : []), [staged, plan, label])
  const effects = useMemo(() => (staged && members ? memberEffects(members, loaded, group.name, plan) : []), [staged, members, loaded, group.name, plan])
  const summary = effectSummary(effects)
  const effectCols = useMemo(() => effectColumns(t), [t])
  const reachCols = useMemo(() => reachColumns(t), [t])
  const reach = useMemo(() => reachRows(effects, t), [effects, t])
  const viewed = effects.find(each => sameId(each.person.id, viewing) && each.count > 0)
  const viewedRows = useMemo(() => (viewed ? effectRows(viewed.effect, { label }) : []), [viewed, label])

  if (acl.failed) return <p className='people-empty'>{t('perun.people.routes_failed')}</p>
  if (!data) return <p className='people-empty'>{t('perun.people.loading')}</p>

  const pickedTable = tables.find(table => sameId(table.id, picked))
  const toggle = (set) => {
    setPicked(null)
    set(value => !value)
  }
  const stage = (tableId, level) => setEdits(current => {
    const next = new Map(current.levels)
    const id = key(tableId)
    if (level === (levels.get(id) ?? 0) || next.get(id) === level) next.delete(id)
    else next.set(id, level)
    return { ...current, levels: next }
  })
  const stageGrant = () => {
    setEdits(current => ({ ...current, grant: [...current.grant, adding] }))
    setAdding('')
  }

  const save = () => {
    if (!staged || busy) return
    setBusy(true)
    runGroupEdit(svSession, group.id, plan)
      .then(() => quietSuccess(t('perun.groups.saved', { group: group.name, count: pending.length })))
      .catch(err => alertUserResponse({ response: err }))
      .finally(() => {
        setLoaded(new Map())
        setViewing(null)
        acl.reload()
      })
  }

  const levelPanel = () => {
    const id = key(pickedTable.id)
    const now = levels.get(id) ?? 0
    const want = edits.levels.get(id)
    const codes = LEVELS.map((_, level) => levelCode(data.index, pickedTable, level))
    const unavailable = codes.filter(code => !code.ok)
    const scopedHere = acls.filter(own => own.configKey && sameId(own.resourceId, pickedTable.id))
    const table = label(pickedTable)
    return (
      <section className='people-level-editor'>
        <h4>{t('perun.groups.level_on', { group: group.name, table })}</h4>
        <div className='people-level-picker' role='group' aria-label={t('perun.groups.level_on', { group: group.name, table })} style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
          {LEVELS.map((name, level) => (
            <button
              key={name}
              type='button'
              className={`people-level${level === now ? ' current' : ''}${level === want ? ' on' : ''}`}
              aria-pressed={level === want}
              aria-current={level === now ? 'true' : undefined}
              title={level === now ? t('perun.people.current_level') : undefined}
              disabled={busy || !codes[level].ok}
              onClick={() => stage(pickedTable.id, level)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className='people-note'>
          {want === undefined
            ? t('perun.groups.pick_level', { level: LEVELS[now] })
            : t('perun.groups.level_staged', { from: LEVELS[now], to: LEVELS[want] })}
        </p>
        {unavailable.length > 0 && (
          <p className='people-note'>
            {unavailable.map(code => t(`perun.groups.level_${code.reason}`, { code: code.code })).join(' ')}
          </p>
        )}
        {scopedHere.length > 0 && (
          <p className='people-note'>{t('perun.groups.scoped_here', { codes: [...new Set(scopedHere.map(own => own.labelCode))].join(', ') })}</p>
        )}
      </section>
    )
  }

  const reachStatus = () => {
    if (members === undefined) return t('perun.people.loading')
    if (!members.length) return t('perun.groups.reach_no_members', { group: group.name })
    if (!wanted) return t('perun.groups.reach_large', { count: members.length })
    if (summary.pending) return t('perun.groups.reach_loading', { done: summary.total - summary.pending, total: summary.total })
    const parts = [summary.affected
      ? t('perun.groups.reach_summary', { count: summary.affected, total: summary.total })
      : t('perun.groups.reach_nobody')]
    if (summary.bypass) parts.push(t('perun.groups.reach_bypass_note', { count: summary.bypass }))
    if (summary.failed) parts.push(t('perun.groups.reach_failed_note', { count: summary.failed }))
    return parts.join(' ')
  }

  return (
    <div className='people-group-permissions'>
      {group.name === ADMINISTRATORS && <Banner title={t('perun.groups.admin_title')}>{t('perun.groups.admin_text')}</Banner>}
      <h4>{t('perun.groups.table_levels')}</h4>
      <div className='people-toolbar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button type='button' className={`people-filter${onlySet ? ' on' : ''}`} aria-pressed={onlySet} onClick={() => toggle(setOnlySet)}>
          {t('perun.groups.only_set')}
        </button>
        <button type='button' className={`people-filter${showSystem ? ' on' : ''}`} aria-pressed={showSystem} onClick={() => toggle(setShowSystem)}>
          {t('perun.people.system_tables', { count: tables.filter(table => table.system).length })}
        </button>
        <span className='people-faint' style={{ marginLeft: 'auto' }}>
          {t('perun.groups.tables_set', { count: levels.size, total: tables.length })}
        </span>
      </div>
      <p className='people-note'>{t('perun.groups.pick_table')}</p>
      <ExportableGrid
        id={`LEVELS_${fileSafe(group.name)}`}
        gridType='SEARCH_GRID_DATA'
        configTableName={levelCols}
        dataTableName={levelData}
        heightRatio={0.45}
        onRowClickFunct={(_grid, _rowIdx, row) => setPicked(row[`${GROUP_LEVELS}.PKID`])}
      />
      {pickedTable && levelPanel()}
      <section className='people-other'>
        <h4>{t('perun.groups.other_codes')}</h4>
        {codeData.length
          ? (
            <CodeActionsContext.Provider value={codeActions}>
              <GenericGrid
                id={`${prefix}_CODES`}
                gridType='SEARCH_GRID_DATA'
                configTableName={codeCols}
                dataTableName={codeData}
                minHeight={fitHeight(codeData.length)}
              />
            </CodeActionsContext.Provider>
          )
          : <p className='people-note'>{t('perun.groups.no_other_codes', { group: group.name })}</p>}
        <div className='people-add-group' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <Select
              options={grantOptions}
              value={adding}
              simpleValue
              onChange={value => setAdding(value || '')}
              placeholder={t('perun.groups.pick_code')}
              noResultsText={t('perun.groups.no_codes_left')}
              aria-label={t('perun.groups.pick_code')}
            />
          </div>
          <button type='button' className='people-btn' disabled={busy || !adding} onClick={stageGrant}>
            {t('perun.groups.add_code')}
          </button>
        </div>
        {leftOut > 0 && <p className='people-note'>{t('perun.groups.ambiguous_left_out', { count: leftOut })}</p>}
      </section>
      {staged && (
        <section className='people-pending'>
          <h4>{t('perun.groups.pending', { group: group.name })}</h4>
          <GenericGrid
            id={`${prefix}_PENDING`}
            gridType='SEARCH_GRID_DATA'
            configTableName={effectCols}
            dataTableName={pending}
            minHeight={fitHeight(pending.length, 6)}
          />
          <h5>{t('perun.groups.reach_title')}</h5>
          <p className='people-reach-status' role='status'>{reachStatus()}</p>
          {members?.length > LARGE && !loadAll && (
            <button type='button' className='people-btn' onClick={() => setLoadAll(true)}>
              {t('perun.groups.reach_load', { count: members.length })}
            </button>
          )}
          {wanted && reach.length > 0 && (
            <>
              <p className='people-note'>{t('perun.groups.reach_pick')}</p>
              <GenericGrid
                id={`${prefix}_REACH`}
                gridType='SEARCH_GRID_DATA'
                configTableName={reachCols}
                dataTableName={reach}
                minHeight={fitHeight(reach.length, 6)}
                onRowClickFunct={(_grid, _rowIdx, row) => setViewing(row[`${GROUP_REACH}.PKID`])}
              />
            </>
          )}
          {viewed && (
            <div className='people-effect'>
              <h5>{t('perun.groups.reach_for', { user: viewed.person.userName })}</h5>
              <GenericGrid
                key={viewed.person.id}
                id={`${prefix}_REACH_EFFECT`}
                gridType='SEARCH_GRID_DATA'
                configTableName={effectCols}
                dataTableName={viewedRows}
                minHeight={fitHeight(viewedRows.length, 6)}
              />
            </div>
          )}
        </section>
      )}
      {staged && (
        <div className='people-pending-bar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: '1 1 240px' }}>
            <b>{t('perun.groups.pending_count', { count: pending.length })}</b>
            {wanted && !summary.pending && <span className='people-faint'> · {t('perun.groups.pending_reach', { count: summary.affected, total: summary.total })}</span>}
          </span>
          <button type='button' className='people-btn primary' disabled={busy} onClick={save}>{t('perun.groups.save')}</button>
          <button type='button' className='people-btn ghost' disabled={busy} onClick={() => setEdits(emptyEdits())}>{t('perun.groups.discard')}</button>
        </div>
      )}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(GroupPermissions)
