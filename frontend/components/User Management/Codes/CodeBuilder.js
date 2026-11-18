import React, { useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse } from '../../../elements'
import { createCodes } from '../People/peopleApi'
import { LEVELS } from '../People/permissionMatrix'
import { checkNewCode, holdersOf } from '../People/aclCatalog'
import { InlineConfirm, quietSuccess, useLabels } from '../People/ui'

const statusText = (check, data, t) => {
  switch (check.reason || check.status) {
    case 'empty': return t('perun.codes.check_empty')
    case 'format': return t('perun.codes.check_format')
    case 'length': return t('perun.codes.check_length', { max: check.max })
    case 'case': return t('perun.codes.check_case', { other: check.other })
    case 'table': return t('perun.codes.check_table', { table: check.table })
    case 'exists': {
      const groups = check.matches.flatMap(match => holdersOf(data, match.aclId).groups.map(group => group.name))
      return groups.length
        ? t('perun.codes.check_exists', { groups: [...new Set(groups)].join(', ') })
        : t('perun.codes.check_exists_unheld')
    }
    default: return t('perun.codes.check_ok')
  }
}

// createCustomAcl ties a code to no table and nothing here can delete one, so the name is checked as it is typed.
const CodeBuilder = ({ svSession, data, onCreated }) => {
  const t = useLabels()
  const [name, setName] = useState('')
  const [level, setLevel] = useState('READ')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const check = checkNewCode(name, { index: data.index, tables: data.tables })
  const ok = check.status === 'ok'

  const create = () => {
    setBusy(true)
    createCodes(svSession, [name], level).then(() => {
      quietSuccess(t('perun.codes.created', { code: name }))
      setName('')
      setConfirming(false)
      onCreated(name)
    }).catch(err => alertUserResponse({ response: err })).finally(() => setBusy(false))
  }

  return (
    <section className='people-code-builder'>
      <h4>{t('perun.codes.new')}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <label className='people-field' style={{ display: 'grid', gap: 4, flex: '2 1 260px', minWidth: 0 }}>
          <span>{t('perun.codes.name')}</span>
          <input
            className='people-input'
            value={name}
            spellCheck={false}
            autoComplete='off'
            placeholder='card.module_access'
            aria-describedby='people-code-status'
            aria-invalid={check.status === 'bad'}
            disabled={busy}
            onChange={e => {
              setName(e.target.value)
              setConfirming(false)
            }}
          />
        </label>
        <label className='people-field' style={{ display: 'grid', gap: 4, flex: '0 1 160px' }}>
          <span>{t('perun.codes.level')}</span>
          <select className='people-input' value={level} disabled={busy} onChange={e => setLevel(e.target.value)}>
            {LEVELS.slice(1).map(each => <option key={each} value={each}>{each}</option>)}
          </select>
        </label>
        <button type='button' className='people-btn primary' disabled={busy || !ok} onClick={() => setConfirming(true)}>
          {t('perun.codes.create')}
        </button>
      </div>
      <p id='people-code-status' className={`people-code-status ${check.status}`} role='status'>{statusText(check, data, t)}</p>
      {confirming && ok && (
        <InlineConfirm
          message={t('perun.codes.create_confirm', { code: name, level })}
          confirmLabel={t('perun.codes.create')}
          busy={busy}
          onConfirm={create}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(CodeBuilder)
