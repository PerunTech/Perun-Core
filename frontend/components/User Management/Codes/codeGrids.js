import React from 'react'
import { labelBasePath } from '../../../config'
import { Aside, Chips, LEVEL_OPTIONS, codes, column, texts, useText, withAside } from '../People/grids'
import { holdersOf, isAmbiguous } from '../People/aclCatalog'

// The grid's id, which names its export files.
export const PERMISSION_CODES = 'PERMISSION_CODES'
export const KINDS = ['table', 'scoped', 'custom']

const CodeCell = ({ row }) => {
  const t = useText()
  return (
    <Aside
      text={row[`${PERMISSION_CODES}.LABEL_CODE`]}
      aside={row[`${PERMISSION_CODES}.CONFIG_KEY`]}
      title={t(`${labelBasePath}.grid_labels.people_grants.config_key`)}
    />
  )
}

const HeldBy = ({ row }) => <Chips chips={row[`${PERMISSION_CODES}.SOURCES`]} empty='perun.codes.held_by_none' />

export const catalogColumns = (t) => [
  column(t, `${PERMISSION_CODES}.CODE`, { formatter: CodeCell }),
  column(t, `${PERMISSION_CODES}.KIND`, {
    width: 120,
    ...codes(KINDS.map(kind => ({ value: kind, text: t(`perun.codes.kind_${kind}`) })))
  }),
  column(t, `${PERMISSION_CODES}.TABLE_NAME`, { width: 190 }),
  column(t, `${PERMISSION_CODES}.LEVEL`, { width: 120, ...codes(LEVEL_OPTIONS) }),
  column(t, `${PERMISSION_CODES}.HELD_BY`, { width: '30%', formatter: HeldBy }),
  column(t, `${PERMISSION_CODES}.NOTE`, { width: 170 })
]

export const catalogRows = (data, { kinds, onlyHeld, t }) => {
  const tableNames = new Map(data.tables.map(table => [String(table.id), table.name]))
  return data.acls.filter(acl => kinds.has(acl.kind)).map(acl => ({ acl, holders: holdersOf(data, acl.aclId) }))
    .filter(({ holders }) => !onlyHeld || holders.groups.length || holders.direct)
    .map(({ acl, holders }) => {
      const sources = [
        ...holders.groups.map(group => ({ kind: 'group', text: group.name })),
        ...(holders.direct ? [{ kind: 'direct', text: t('perun.codes.direct_holders', { count: holders.direct }) }] : [])
      ]
      const shared = isAmbiguous(data.index, acl.labelCode) ? data.index.byLabel.get(acl.labelCode).length : 0
      return {
        [`${PERMISSION_CODES}.PKID`]: acl.aclId,
        [`${PERMISSION_CODES}.CODE`]: withAside(acl.labelCode, acl.configKey),
        [`${PERMISSION_CODES}.LABEL_CODE`]: acl.labelCode,
        [`${PERMISSION_CODES}.CONFIG_KEY`]: acl.configKey || '',
        [`${PERMISSION_CODES}.KIND`]: acl.kind,
        [`${PERMISSION_CODES}.TABLE_NAME`]: acl.kind === 'custom' ? '' : tableNames.get(String(acl.resourceId)) || '',
        [`${PERMISSION_CODES}.LEVEL`]: acl.level,
        [`${PERMISSION_CODES}.HELD_BY`]: texts(sources),
        [`${PERMISSION_CODES}.SOURCES`]: sources,
        [`${PERMISSION_CODES}.NOTE`]: shared ? t('perun.codes.shared_label', { count: shared }) : ''
      }
    })
}
