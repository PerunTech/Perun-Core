import React, { createContext, useContext } from 'react'
import { labelBasePath } from '../../../config'
import { Aside, LEVEL_OPTIONS, codes, column, effectRow, useText, withAside } from '../People/grids'
import { levelOf } from '../People/permissionMatrix'
import { fullName } from '../People/people'

// The list grid's id, which names its export files.
export const USER_GROUPS = 'USER_GROUPS'
export const GROUP_LEVELS = 'GROUP_LEVELS'
export const GROUP_CODES = 'GROUP_CODES'
export const GROUP_REACH = 'GROUP_REACH'

const groupField = (row, field) => row?.[`SVAROG_USER_GROUPS.${field}`]

export const toGroupRecord = (row) => ({
  id: groupField(row, 'OBJECT_ID'),
  name: groupField(row, 'GROUP_NAME') || '',
  type: groupField(row, 'GROUP_TYPE') || '',
  securityType: groupField(row, 'GROUP_SECURITY_TYPE') || '',
  email: groupField(row, 'E_MAIL') || ''
})

export const sortByName = (groups) => [...groups].sort((a, b) => a.name.localeCompare(b.name))

export const groupListColumns = (t) => [
  column(t, `${USER_GROUPS}.GROUP_NAME`, { isDefaultSort: true, defaultSortDirection: 'ASC' }),
  column(t, `${USER_GROUPS}.GROUP_TYPE`, { width: 150 }),
  column(t, `${USER_GROUPS}.GROUP_SECURITY_TYPE`, { width: 170 }),
  column(t, `${USER_GROUPS}.E_MAIL`),
  column(t, `${USER_GROUPS}.CODES`, { width: 110 })
]

export const groupListRows = (groups, data) => groups.map(group => ({
  [`${USER_GROUPS}.PKID`]: group.id,
  [`${USER_GROUPS}.GROUP_NAME`]: group.name,
  [`${USER_GROUPS}.GROUP_TYPE`]: group.type,
  [`${USER_GROUPS}.GROUP_SECURITY_TYPE`]: group.securityType,
  [`${USER_GROUPS}.E_MAIL`]: group.email,
  [`${USER_GROUPS}.CODES`]: data ? data.permissionsOf(group.id).length : ''
}))

const LevelTable = ({ row }) => {
  const t = useText()
  return (
    <Aside
      text={row[`${GROUP_LEVELS}.LABEL`]}
      aside={row[`${GROUP_LEVELS}.TABLE_NAME`]}
      title={t(`${labelBasePath}.grid_labels.people_access.table_name`)}
    />
  )
}

export const levelColumns = (t) => [
  column(t, `${GROUP_LEVELS}.TABLE`, { formatter: LevelTable }),
  column(t, `${GROUP_LEVELS}.LEVEL`, { width: 130, ...codes(LEVEL_OPTIONS) }),
  column(t, `${GROUP_LEVELS}.SCOPED`, { width: 150 })
]

// Staged levels stay out of these rows: new rows make the grid drop its filters.
export const levelRows = (tables, { levels, scoped, label }) => tables.map(table => ({
  [`${GROUP_LEVELS}.PKID`]: table.id,
  [`${GROUP_LEVELS}.TABLE`]: withAside(label(table), table.name),
  [`${GROUP_LEVELS}.LABEL`]: label(table),
  [`${GROUP_LEVELS}.TABLE_NAME`]: table.name,
  [`${GROUP_LEVELS}.LEVEL`]: levels.get(String(table.id)) ?? 0,
  [`${GROUP_LEVELS}.SCOPED`]: scoped.get(String(table.id)) || ''
}))

const CodeCell = ({ row }) => {
  const t = useText()
  return (
    <Aside
      text={row[`${GROUP_CODES}.LABEL_CODE`]}
      aside={row[`${GROUP_CODES}.CONFIG_KEY`]}
      title={t(`${labelBasePath}.grid_labels.people_grants.config_key`)}
    />
  )
}

export const CodeActionsContext = createContext(null)

// The cell's clicks stop here: they are the button's, not a row click.
const CodeActions = ({ row }) => {
  const t = useText()
  const actions = useContext(CodeActionsContext)
  if (!actions) return null
  const change = row[`${GROUP_CODES}.CHANGE_KEY`]
  return (
    <span className='people-cell-actions' style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
      <button
        type='button'
        className={`people-btn small ghost${change ? '' : ' danger'}`}
        disabled={actions.busy}
        onClick={() => (change ? actions.undo(row) : actions.revoke(row))}
      >
        {t(change ? 'perun.groups.undo' : 'perun.admin_console.remove')}
      </button>
    </span>
  )
}

export const codeColumns = (t) => [
  column(t, `${GROUP_CODES}.CODE`, { formatter: CodeCell }),
  column(t, `${GROUP_CODES}.KIND`, { width: 130 }),
  column(t, `${GROUP_CODES}.TABLE_NAME`, { width: 170 }),
  column(t, `${GROUP_CODES}.LEVEL`, { width: 120, ...codes(LEVEL_OPTIONS) }),
  column(t, `${GROUP_CODES}.CHANGE`, { width: 130 }),
  column(t, `${GROUP_CODES}.ACTIONS`, { width: 120, sortable: false, filterable: false, resizable: false, formatter: CodeActions })
]

// The group's codes that aren't a table's level, one row per label, and the ones staged to be granted.
export const codeRows = ({ held, granting, revoking, tableName, t }) => {
  const row = (entry, change) => ({
    [`${GROUP_CODES}.PKID`]: change === 'grant' ? `grant:${entry.aclId}` : entry.labelCode,
    [`${GROUP_CODES}.ACL_ID`]: entry.aclId,
    [`${GROUP_CODES}.CODE`]: withAside(entry.labelCode, entry.configKey),
    [`${GROUP_CODES}.LABEL_CODE`]: entry.labelCode,
    [`${GROUP_CODES}.CONFIG_KEY`]: entry.configKey || '',
    [`${GROUP_CODES}.KIND`]: t(`perun.codes.kind_${entry.kind}`),
    [`${GROUP_CODES}.TABLE_NAME`]: entry.kind === 'custom' ? '' : tableName(entry.resourceId),
    [`${GROUP_CODES}.LEVEL`]: levelOf(entry.accessType),
    [`${GROUP_CODES}.CHANGE`]: change ? t(`perun.groups.to_${change}`) : '',
    [`${GROUP_CODES}.CHANGE_KEY`]: change || ''
  })
  const labels = new Map()
  held.forEach(entry => labels.has(entry.labelCode) || labels.set(entry.labelCode, entry))
  return [
    ...[...labels.values()].map(entry => row(entry, revoking.has(entry.labelCode) ? 'revoke' : '')),
    ...granting.map(entry => row(entry, 'grant'))
  ]
}

export const reachColumns = (t) => [
  column(t, `${GROUP_REACH}.NAME`, { isDefaultSort: true, defaultSortDirection: 'ASC' }),
  column(t, `${GROUP_REACH}.USER_NAME`),
  column(t, `${GROUP_REACH}.CHANGES`, { width: '35%' })
]

const reachText = (each, t) => {
  if (each.pending) return t('perun.groups.reach_pending')
  if (each.failed) return t('perun.groups.reach_failed')
  if (each.bypass) return t('perun.groups.reach_bypass')
  return each.count ? t('perun.groups.reach_changes', { count: each.count }) : t('perun.groups.reach_none')
}

export const reachRows = (effects, t) => effects.map(each => ({
  [`${GROUP_REACH}.PKID`]: each.person.id,
  [`${GROUP_REACH}.NAME`]: fullName(each.person),
  [`${GROUP_REACH}.USER_NAME`]: each.person.userName,
  [`${GROUP_REACH}.CHANGES`]: reachText(each, t),
  additionalClassName: each.count ? 'people-grant-sets' : undefined
}))

// What a save sends, as before and after levels.
export const pendingRows = (plan, label) => [
  ...plan.changes.map(change => effectRow(`table:${change.table.id}`, label(change.table), change.table.name, change.from, change.to)),
  ...plan.codeGrants.map(acl => effectRow(`grant:${acl.aclId}`, acl.labelCode, acl.configKey, 0, levelOf(acl.accessType))),
  ...plan.codeRevokes.map(({ labelCode, acl }) =>
    effectRow(`revoke:${labelCode}`, labelCode, acl.configKey, levelOf(acl.accessType), 0))
]
