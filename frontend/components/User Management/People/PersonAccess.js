import React, { useEffect, useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { alertUserResponse, ExportableGrid } from '../../../elements'
import GenericGrid from '../../../elements/grid/GenericGrid'
import { getDynamicKey } from '../../../functions/utils'
import { getAccess } from './peopleApi'
import { isActive, sameId } from './people'
import { countWithAccess, filterRows, readMatrix, tableLabel } from './permissionMatrix'
import { accessState } from './accessRoutes'
import {
  ACCESS, accessColumns, accessRows, fitHeight, grantColumns, grantRows, otherColumns, otherRows
} from './grids'
import { Banner, useLabels } from './ui'
import LevelEditor from './LevelEditor'

const fileSafe = (text) => String(text).replace(/[^\w-]/g, '_')

const Grants = ({ prefix, row, label, bypass }) => {
  const t = useLabels()
  const columns = useMemo(() => grantColumns(t), [t])
  const rows = useMemo(() => grantRows(row, t), [row, t])
  let body
  if (bypass) body = <p className='people-note'>{t('perun.people.bypass_row')}</p>
  else if (!rows.length) body = <p className='people-note'>{t('perun.people.no_grants')}</p>
  else {
    body = (
      <GenericGrid
        id={`${prefix}_GRANTS_${row.id}`}
        gridType='SEARCH_GRID_DATA'
        configTableName={columns}
        dataTableName={rows}
        minHeight={fitHeight(rows.length)}
      />
    )
  }
  return (
    <section className='people-grants'>
      <h4>{t('perun.people.grants_on', { table: label })}</h4>
      {body}
    </section>
  )
}

const OtherPermissions = ({ prefix, matrix }) => {
  const t = useLabels()
  const columns = useMemo(() => otherColumns(t), [t])
  const rows = useMemo(() => otherRows(matrix, t), [matrix, t])
  if (matrix.bypass || !rows.length) return null
  return (
    <section className='people-other'>
      <h4>{t('perun.people.other')}</h4>
      <GenericGrid
        id={`${prefix}_OTHER`}
        gridType='SEARCH_GRID_DATA'
        configTableName={columns}
        dataTableName={rows}
        minHeight={fitHeight(rows.length)}
      />
    </section>
  )
}

const PersonAccess = ({ svSession, person }) => {
  const t = useLabels()
  const { messages } = useIntl()
  const [prefix] = useState(() => getDynamicKey())
  const [loaded, setLoaded] = useState(undefined)
  const [reload, setReload] = useState(0)
  const [failed, setFailed] = useState(false)
  const [onlyWithAccess, setOnlyWithAccess] = useState(true)
  const [showSystem, setShowSystem] = useState(false)
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getAccess(svSession, person.id).then(body => {
      if (!cancelled) setLoaded(current => ({ body, at: (current?.at ?? 0) + 1 }))
    }).catch(err => {
      if (cancelled) return
      setFailed(true)
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, person.id, reload])

  const matrix = useMemo(() => (loaded ? readMatrix(loaded.body) : undefined), [loaded])
  const state = useMemo(() => (loaded ? accessState(loaded.body) : undefined), [loaded])
  const label = useMemo(() => (row) => tableLabel(row, messages), [messages])
  const columns = useMemo(() => accessColumns(t), [t])
  const rows = useMemo(() => (matrix
    ? accessRows(filterRows(matrix.rows, { onlyWithAccess, system: showSystem }), { bypass: matrix.bypass, label, t })
    : []), [matrix, onlyWithAccess, showSystem, label, t])

  if (failed) return <p className='people-empty'>{t('perun.people.access_failed')}</p>
  if (!matrix) return <p className='people-empty'>{t('perun.people.loading')}</p>

  const pickedRow = matrix.rows.find(row => sameId(row.id, picked))
  const systemCount = matrix.rows.filter(row => row.system).length
  // New rows clear the grid's clicked row, so the grants below go with it.
  const toggle = (set) => {
    setPicked(null)
    set(value => !value)
  }

  return (
    <div className='people-access-tab'>
      {matrix.bypass && <Banner title={t('perun.people.bypass_title')}>{t('perun.people.bypass_text')}</Banner>}
      {!isActive(person) && <Banner kind='warn' title={t('perun.people.disabled_title')}>{t('perun.people.disabled_text')}</Banner>}
      <div className='people-toolbar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button
          type='button'
          className={`people-filter${onlyWithAccess ? ' on' : ''}`}
          aria-pressed={onlyWithAccess}
          onClick={() => toggle(setOnlyWithAccess)}
        >
          {t('perun.people.only_with_access')}
        </button>
        {systemCount > 0 && (
          <button
            type='button'
            className={`people-filter${showSystem ? ' on' : ''}`}
            aria-pressed={showSystem}
            onClick={() => toggle(setShowSystem)}
          >
            {t('perun.people.system_tables', { count: systemCount })}
          </button>
        )}
        <span className='people-faint' style={{ marginLeft: 'auto' }}>
          {t('perun.people.tables_with_access', { count: countWithAccess(matrix.rows), total: matrix.rows.length })}
        </span>
      </div>
      <p className='people-note'>{t('perun.people.pick_table')}</p>
      <ExportableGrid
        id={`ACCESS_${fileSafe(person.userName || person.id)}`}
        gridType='SEARCH_GRID_DATA'
        configTableName={columns}
        dataTableName={rows}
        heightRatio={0.5}
        onRowClickFunct={(_grid, _rowIdx, row) => setPicked(row[`${ACCESS}.PKID`])}
      />
      {pickedRow && !matrix.bypass && (
        <LevelEditor
          key={`editor:${pickedRow.id}:${loaded.at}`}
          person={person}
          row={pickedRow}
          state={state}
          label={label}
          prefix={prefix}
          onApplied={() => setReload(count => count + 1)}
        />
      )}
      {pickedRow && <Grants key={`grants:${pickedRow.id}:${loaded.at}`} prefix={prefix} row={pickedRow} label={label(pickedRow)} bypass={matrix.bypass} />}
      <OtherPermissions prefix={prefix} matrix={matrix} />
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(PersonAccess)
