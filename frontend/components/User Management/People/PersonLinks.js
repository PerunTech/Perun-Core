import React, { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import { ComponentManager, GenericForm, GenericGrid, GridManager } from '../../../client'
import { alertUserResponse, Icon } from '../../../elements'
import { getDynamicKey } from '../../../functions/utils'
import { getLinkedTables, linkRecord, searchRecords, unlinkRecord } from './peopleApi'
import { InlineConfirm, quietSuccess, useLabels } from './ui'

const PersonLinks = ({ svSession, person }) => {
  const t = useLabels()
  const [prefix] = useState(() => getDynamicKey())
  const [tables, setTables] = useState(undefined)
  const [table, setTable] = useState(undefined)
  const [selected, setSelected] = useState(null)
  const [searchFormId, setSearchFormId] = useState(null)
  const [results, setResults] = useState(undefined)
  const [searches, setSearches] = useState(0)
  const [picked, setPicked] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getLinkedTables(svSession, person.objectType).then(list => {
      if (cancelled) return
      setTables(list)
      setTable(list[0]?.name)
    }).catch(err => {
      if (cancelled) return
      setTables([])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, person.objectType])

  const linkedGridId = `${prefix}_${table}_LINKED`
  const recordId = row => row?.[`${table}.OBJECT_ID`]

  const closeSearch = () => {
    setSearchFormId(null)
    setResults(undefined)
    setPicked(null)
  }

  const chooseTable = (name) => {
    setTable(name)
    setSelected(null)
    setConfirm(null)
    closeSearch()
  }

  const search = (e, formId) => {
    setResults(undefined)
    setPicked(null)
    searchRecords(svSession, table, e.formData).then(rows => {
      setResults(rows)
      setSearches(count => count + 1)
    }).catch(err => alertUserResponse({ response: err })).finally(() => {
      ComponentManager.setStateForComponent(formId, null, { saveExecuted: false })
    })
  }

  const run = (call, done) => {
    setBusy(true)
    call.then(() => {
      quietSuccess(done)
      setSelected(null)
      closeSearch()
      GridManager.reloadGridData(linkedGridId)
    }).catch(err => alertUserResponse({ response: err })).finally(() => {
      setBusy(false)
      setConfirm(null)
    })
  }

  if (!tables) return <p className='people-empty'>{t('perun.people.loading')}</p>
  if (!tables.length) return <p className='people-empty'>{t('perun.people.no_link_tables')}</p>

  const values = { user: person.userName, record: recordId(confirm === 'link' ? picked : selected) }

  return (
    <div className='people-links-tab'>
      {tables.length > 1 && (
        <div className='people-subtabs' role='tablist' style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tables.map(item => (
            <button
              key={item.name}
              type='button'
              role='tab'
              aria-selected={item.name === table}
              className={`people-filter${item.name === table ? ' on' : ''}`}
              onClick={() => chooseTable(item.name)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className='people-toolbar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span className='people-faint' style={{ flex: '1 1 200px' }}>{t(selected ? 'perun.people.record_selected' : 'perun.people.select_record', { record: recordId(selected) })}</span>
        <button type='button' className='people-btn ghost danger' disabled={busy || !selected} onClick={() => setConfirm('unlink')}>
          <Icon name='IconUnlink' size={16} aria-hidden='true' />
          <span>{t('perun.people.unlink')}</span>
        </button>
        <button
          type='button'
          className='people-btn'
          aria-expanded={Boolean(searchFormId)}
          onClick={() => (searchFormId ? closeSearch() : setSearchFormId(getDynamicKey()))}
        >
          <Icon name={searchFormId ? 'IconX' : 'IconLink'} size={16} aria-hidden='true' />
          <span>{t(searchFormId ? 'perun.people.close_search' : 'perun.people.link_record')}</span>
        </button>
      </div>
      {confirm === 'unlink' && (
        <InlineConfirm
          message={t('perun.people.unlink_confirm', values)}
          confirmLabel={t('perun.people.unlink')}
          danger
          busy={busy}
          onConfirm={() => run(unlinkRecord(svSession, person.id, table, recordId(selected)), t('perun.people.unlink_done', values))}
          onCancel={() => setConfirm(null)}
        />
      )}
      {searchFormId && (
        <div className='people-link-search'>
          <GenericForm
            params='READ_URL'
            key={searchFormId}
            id={searchFormId}
            method={`/ReactElements/getTableSearchJSONSchema/${svSession}/${table}`}
            uiSchemaConfigMethod={`/ReactElements/getTableUISchemaOverride/${svSession}/${table}`}
            tableFormDataMethod={`/ReactElements/getTableFormData/${svSession}/0/${table}`}
            addSaveFunction={(e) => search(e, searchFormId)}
            hideBtns='closeAndDelete'
            customSaveButtonName={t('perun.main.grids.search')}
            customSave
            disableHelpButtons
          />
          {results && !results.length && <p className='people-empty'>{t('perun.people.no_records')}</p>}
          {results?.length > 0 && (
            <>
              <GenericGrid
                key={`${prefix}_${table}_RESULTS_${searches}`}
                id={`${prefix}_${table}_RESULTS_${searches}`}
                gridType='SEARCH_GRID_DATA'
                configTableName={`/ReactElements/getTableFieldList/${svSession}/${table}`}
                dataTableName={results}
                minHeight={290}
                refreshData
                onRowClickFunct={(_id, _rowIdx, row) => setPicked(row)}
              />
              <div className='people-toolbar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span className='people-faint' style={{ flex: '1 1 200px' }}>{t(picked ? 'perun.people.record_selected' : 'perun.people.select_record', { record: recordId(picked) })}</span>
                <button type='button' className='people-btn primary' disabled={busy || !picked} onClick={() => setConfirm('link')}>
                  <Icon name='IconLink' size={16} aria-hidden='true' />
                  <span>{t('perun.people.link')}</span>
                </button>
              </div>
              {confirm === 'link' && (
                <InlineConfirm
                  message={t('perun.people.link_confirm', values)}
                  confirmLabel={t('perun.people.link')}
                  busy={busy}
                  onConfirm={() => run(linkRecord(svSession, person.id, table, recordId(picked)), t('perun.people.link_done', values))}
                  onCancel={() => setConfirm(null)}
                />
              )}
            </>
          )}
        </div>
      )}
      {table && (
        <GenericGrid
          key={linkedGridId}
          id={linkedGridId}
          gridType='READ_URL'
          configTableName={`/ReactElements/getTableFieldList/${svSession}/${table}`}
          dataTableName={`/ReactElements/getObjectByLink/${svSession}/${person.id}/${table}/POA/0`}
          minHeight={400}
          refreshData
          onRowClickFunct={(_id, _rowIdx, row) => setSelected(row)}
        />
      )}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(PersonLinks)
