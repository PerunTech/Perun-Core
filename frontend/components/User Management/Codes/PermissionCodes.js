import React, { useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { ExportableGrid } from '../../../elements'
import { LEVELS } from '../People/permissionMatrix'
import { holdersOf, isAmbiguous } from '../People/aclCatalog'
import { useAclData } from '../People/useAclData'
import { Banner, useLabels } from '../People/ui'
import { KINDS, PERMISSION_CODES, catalogColumns, catalogRows } from './codeGrids'
import CodeBuilder from './CodeBuilder'

const CodeDetails = ({ data, aclId, openGroup }) => {
  const t = useLabels()
  const entry = data.index.byId.get(String(aclId))
  if (!entry) return null
  const holders = holdersOf(data, aclId)
  const table = data.tables.find(each => String(each.id) === String(entry.resourceId))
  const shared = isAmbiguous(data.index, entry.labelCode) ? data.index.byLabel.get(entry.labelCode) : null
  const facts = [
    t(`perun.codes.kind_${entry.kind}`),
    t('perun.codes.fact_level', { level: LEVELS[entry.level] }),
    ...(table && entry.kind !== 'custom' ? [t('perun.codes.fact_table', { table: table.name })] : []),
    ...(entry.configKey && entry.configKey !== entry.labelCode ? [t('perun.codes.fact_scope', { key: entry.configKey })] : [])
  ]
  return (
    <section className='people-code-details'>
      <h4><code>{entry.labelCode}</code></h4>
      <p className='people-faint'>{facts.join(' · ')}</p>
      {shared && (
        <Banner kind='warn' title={t('perun.codes.shared_title', { count: shared.length })}>
          {t('perun.codes.shared_text')}
        </Banner>
      )}
      {holders.groups.length
        ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span>{t('perun.codes.held_by')}</span>
            {holders.groups.map(group => (
              <button key={group.id} type='button' className='people-chip group people-chip-link' onClick={() => openGroup(group.id)}>
                {group.name}
              </button>
            ))}
          </div>
        )
        : <p className='people-note'>{t('perun.codes.held_by_no_group')}</p>}
      {holders.direct > 0 && <p className='people-note'>{t('perun.codes.direct_note', { count: holders.direct })}</p>}
    </section>
  )
}

const PermissionCodes = ({ svSession, openGroup }) => {
  const t = useLabels()
  const acl = useAclData(svSession)
  const [kinds, setKinds] = useState(() => new Set(['scoped', 'custom']))
  const [onlyHeld, setOnlyHeld] = useState(false)
  const [picked, setPicked] = useState(null)
  const [createdCode, setCreatedCode] = useState(null)
  const { data } = acl

  const columns = useMemo(() => catalogColumns(t), [t])
  const rows = useMemo(() => (data ? catalogRows(data, { kinds, onlyHeld, t }) : []), [data, kinds, onlyHeld, t])

  if (acl.failed) return <div className='people people-codes'><p className='people-empty'>{t('perun.codes.failed')}</p></div>
  if (!data) return <div className='people people-codes'><p className='people-empty'>{t('perun.people.loading')}</p></div>

  const counts = Object.fromEntries(KINDS.map(kind => [kind, data.acls.filter(entry => entry.kind === kind).length]))
  const toggleKind = (kind) => {
    setPicked(null)
    setKinds(current => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }
  const created = (code) => {
    acl.reload()
    setKinds(current => new Set([...current, 'custom']))
    setPicked(null)
    setCreatedCode(code)
  }
  const pickedId = picked ?? (createdCode ? data.index.byLabel.get(createdCode)?.[0]?.aclId : null)

  return (
    <div className='people people-codes'>
      <p className='people-note'>{t('perun.codes.intro')}</p>
      <CodeBuilder data={data} onCreated={created} />
      <div className='people-toolbar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {KINDS.map(kind => (
          <button key={kind} type='button' className={`people-filter${kinds.has(kind) ? ' on' : ''}`} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}>
            {t(`perun.codes.filter_${kind}`, { count: counts[kind] })}
          </button>
        ))}
        <button
          type='button'
          className={`people-filter${onlyHeld ? ' on' : ''}`}
          aria-pressed={onlyHeld}
          onClick={() => {
            setPicked(null)
            setOnlyHeld(value => !value)
          }}
        >
          {t('perun.codes.only_held')}
        </button>
        <span className='people-faint' style={{ marginLeft: 'auto' }}>
          {t('perun.codes.count', { count: rows.length, total: data.acls.length })}
        </span>
      </div>
      <p className='people-note'>{t('perun.codes.pick_code')}</p>
      <ExportableGrid
        id={PERMISSION_CODES}
        gridType='SEARCH_GRID_DATA'
        configTableName={columns}
        dataTableName={rows}
        heightRatio={0.5}
        onRowClickFunct={(_grid, _rowIdx, row) => {
          setCreatedCode(null)
          setPicked(row[`${PERMISSION_CODES}.PKID`])
        }}
      />
      {pickedId !== undefined && pickedId !== null && <CodeDetails key={pickedId} data={data} aclId={pickedId} openGroup={openGroup} />}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(PermissionCodes)
