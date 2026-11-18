import React, { useEffect, useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import { alertUserResponse, Icon, Select } from '../../../elements'
import { getDynamicKey } from '../../../functions/utils'
import { getAccess, listPeople } from '../People/peopleApi'
import { LEVELS, readMatrix, tableLabel } from '../People/permissionMatrix'
import { accessState } from '../People/accessRoutes'
import { fullName, isActive, sameId, sortPeople } from '../People/people'
import { withAside } from '../People/grids'
import { useAclData } from '../People/useAclData'
import { useLabels } from '../People/ui'
import LevelEditor from '../People/LevelEditor'
import { checkCode, checkTable } from './accessCheck'
import CodeFix from './CodeFix'

const byLabel = (a, b) => a.label.localeCompare(b.label)

// "Can this user do X?", answered from their permission matrix, with the group changes that would make it yes.
const AccessCheck = ({ svSession, openPerson }) => {
  const t = useLabels()
  const { messages } = useIntl()
  const [prefix] = useState(() => getDynamicKey())
  const acl = useAclData(svSession)
  const [people, setPeople] = useState(undefined)
  const [personId, setPersonId] = useState('')
  const [mode, setMode] = useState('table')
  const [tableId, setTableId] = useState('')
  const [need, setNeed] = useState(1)
  const [codeId, setCodeId] = useState('')
  const [loaded, setLoaded] = useState(undefined)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    listPeople(svSession).then(list => {
      if (!cancelled) setPeople(sortPeople(list))
    }).catch(err => {
      if (cancelled) return
      setPeople([])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession])

  useEffect(() => {
    if (!svSession || !personId) return
    let cancelled = false
    getAccess(svSession, personId).then(body => {
      if (!cancelled) setLoaded(current => ({ id: personId, body, at: (current?.at ?? 0) + 1 }))
    }).catch(err => {
      if (cancelled) return
      setLoaded({ id: personId, failed: true })
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, personId, reload])

  const label = useMemo(() => (row) => tableLabel(row, messages), [messages])
  const current = loaded && sameId(loaded.id, personId) && !loaded.failed ? loaded : null
  const matrix = useMemo(() => (current ? readMatrix(current.body) : null), [current])
  const state = useMemo(() => (current ? accessState(current.body) : null), [current])
  const person = people?.find(each => sameId(each.id, personId))

  const personOptions = useMemo(() => (people || [])
    .map(each => ({ value: String(each.id), label: `${fullName(each)} (${each.userName})` })), [people])
  const tableOptions = useMemo(() => (matrix?.rows || acl.data?.tables || [])
    .map(row => ({ value: String(row.id), label: withAside(label(row), row.name) })).sort(byLabel), [matrix, acl.data, label])
  const codeOptions = useMemo(() => (acl.data?.acls || []).filter(entry => entry.kind !== 'table')
    .map(entry => ({ value: String(entry.aclId), label: withAside(entry.labelCode, entry.configKey) })).sort(byLabel), [acl.data])

  const tableCheck = mode === 'table' && matrix && tableId ? checkTable(matrix, tableId, need) : null
  const codeEntry = acl.data?.index.byId.get(String(codeId))
  const codeCheck = mode === 'code' && matrix && codeEntry ? checkCode(matrix, codeId) : null
  const check = tableCheck || codeCheck

  const verdict = () => {
    const user = person.userName
    const through = (groups, direct) => [...groups, ...(direct ? [t('perun.people.direct_source')] : [])].join(', ')
    if (check.verdict === 'bypass') return t('perun.check.bypass', { user })
    if (codeCheck) {
      const code = codeEntry.labelCode
      return codeCheck.verdict === 'yes'
        ? t('perun.check.code_yes', { user, code, through: through(codeCheck.groups, codeCheck.direct) })
        : t('perun.check.code_no', { user, code })
    }
    const table = label(tableCheck.row)
    const level = LEVELS[tableCheck.level]
    const via = through(tableCheck.groups, tableCheck.direct)
    if (tableCheck.verdict === 'yes') return t('perun.check.table_yes', { user, level, table, through: via })
    if (tableCheck.level > 0) return t('perun.check.table_below', { user, level, table, through: via, need: LEVELS[need] })
    return t('perun.check.table_none', { user, table })
  }

  const result = () => {
    if (!personId) return <p className='people-note'>{t('perun.check.pick_person')}</p>
    if (loaded?.failed && sameId(loaded.id, personId)) return <p className='people-note'>{t('perun.people.access_failed')}</p>
    if (!matrix || !person) return <p className='people-note'>{t('perun.people.loading')}</p>
    if (!check) return <p className='people-note'>{t(mode === 'table' ? 'perun.check.pick_table' : 'perun.check.pick_code')}</p>
    const yes = check.verdict !== 'no'
    return (
      <>
        <div className={`people-verdict ${yes ? 'yes' : 'no'}`} role='status' style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Icon name={yes ? 'IconCircleCheck' : 'IconCircleX'} size={24} aria-hidden='true' style={{ flex: 'none' }} />
          <div style={{ display: 'grid', gap: 4 }}>
            <p><b>{verdict()}</b></p>
            {!isActive(person) && <p className='people-faint'>{t('perun.check.disabled')}</p>}
            {tableCheck?.scoped.length > 0 && <p className='people-faint'>{t('perun.check.scoped', { keys: tableCheck.scoped.join(', ') })}</p>}
          </div>
          <button type='button' className='people-btn ghost small' style={{ marginLeft: 'auto' }} onClick={() => openPerson(person.id)}>
            {t('perun.check.open_person', { user: person.userName })}
          </button>
        </div>
        {tableCheck?.verdict === 'no' && (
          <LevelEditor
            key={`${personId}:${tableId}:${need}:${current.at}`}
            person={person}
            row={tableCheck.row}
            state={state}
            label={label}
            prefix={prefix}
            initialTarget={need}
            onApplied={() => setReload(count => count + 1)}
          />
        )}
        {codeCheck?.verdict === 'no' && acl.data && (
          <CodeFix
            key={`${personId}:${codeId}:${current.at}`}
            person={person}
            state={state}
            aclId={codeId}
            code={codeEntry.labelCode}
            data={acl.data}
            label={label}
            prefix={prefix}
            onApplied={() => setReload(count => count + 1)}
          />
        )}
        {check.verdict === 'no' && <p className='people-note'>{t('perun.check.cache_note', { user: person.userName })}</p>}
      </>
    )
  }

  return (
    <div className='people people-check'>
      <p className='people-note'>{t('perun.check.intro')}</p>
      <div className='people-check-form' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'end' }}>
        <div className='people-field' style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span>{t('perun.check.person')}</span>
          <Select
            options={personOptions}
            value={personId}
            simpleValue
            onChange={value => setPersonId(value || '')}
            placeholder={t('perun.check.pick_person_short')}
            aria-label={t('perun.check.person')}
          />
        </div>
        <div className='people-field' style={{ display: 'grid', gap: 4 }}>
          <span>{t('perun.check.what')}</span>
          <div role='group' aria-label={t('perun.check.what')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['table', 'code'].map(each => (
              <button key={each} type='button' className={`people-filter${mode === each ? ' on' : ''}`} aria-pressed={mode === each} onClick={() => setMode(each)}>
                {t(`perun.check.mode_${each}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {mode === 'table'
        ? (
          <div className='people-check-form' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'end' }}>
            <div className='people-field' style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <span>{t('perun.check.table')}</span>
              <Select
                options={tableOptions}
                value={tableId}
                simpleValue
                onChange={value => setTableId(value || '')}
                placeholder={t('perun.check.pick_table_short')}
                aria-label={t('perun.check.table')}
              />
            </div>
            <div className='people-field' style={{ display: 'grid', gap: 4 }}>
              <span>{t('perun.check.needs')}</span>
              <div className='people-level-picker' role='group' aria-label={t('perun.check.needs')} style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
                {LEVELS.slice(1).map((name, i) => (
                  <button key={name} type='button' className={`people-level${need === i + 1 ? ' on' : ''}`} aria-pressed={need === i + 1} onClick={() => setNeed(i + 1)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        : (
          <div className='people-check-form' style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div className='people-field' style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <span>{t('perun.check.code')}</span>
              <Select
                options={codeOptions}
                value={codeId}
                simpleValue
                onChange={value => setCodeId(value || '')}
                placeholder={t('perun.check.pick_code_short')}
                aria-label={t('perun.check.code')}
              />
            </div>
          </div>
        )}
      <div className='people-check-result'>{result()}</div>
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(AccessCheck)
