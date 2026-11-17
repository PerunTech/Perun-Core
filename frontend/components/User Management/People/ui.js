import React, { useCallback } from 'react'
import { useIntl } from 'react-intl'
import { alertUserV2 } from '../../../elements'

export const useLabels = () => {
  const intl = useIntl()
  return useCallback((id, values) => intl.formatMessage({ id, defaultMessage: id }, values), [intl])
}

export const quietSuccess = (title) => alertUserV2({
  type: 'success', title, toast: true, position: 'bottom-end', showConfirm: false, timer: 2500
})

export const InlineConfirm = ({ message, confirmLabel, danger, busy, onConfirm, onCancel }) => {
  const t = useLabels()
  return (
    <div className='people-confirm' role='alert' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: '1 1 240px' }}>{message}</span>
      <button type='button' className={`people-btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type='button' className='people-btn ghost' disabled={busy} onClick={onCancel}>{t('perun.my_profile.cancel')}</button>
    </div>
  )
}

export const Banner = ({ kind = 'info', title, children }) => (
  <div className={`people-banner ${kind}`} role={kind === 'warn' ? 'alert' : 'status'}>
    <b>{title}</b>
    {children && <span>{children}</span>}
  </div>
)
