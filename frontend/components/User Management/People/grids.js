import React, { createContext, useContext } from 'react'
import { useIntl } from 'react-intl'
import { labelBasePath } from '../../../config'
import { LEVELS, grantEffect } from './permissionMatrix'
import { fullName } from './people'

// Not ui.js's useLabels: ui.js loads the store, and the unit tests import this file.
const useText = () => {
  const intl = useIntl()
  return (id) => intl.formatMessage({ id, defaultMessage: id })
}

export const PEOPLE = 'PEOPLE'
export const ACCESS = 'PEOPLE_ACCESS'
export const GRANTS = 'PEOPLE_GRANTS'
export const GROUPS = 'PEOPLE_GROUPS'

const HEADER = 50
const ROW = 35
// Room for a horizontal scrollbar, so a short grid doesn't scroll vertically as well.
const SPARE = 18

export const fitHeight = (count, maxRows = 8) => HEADER + ROW * Math.min(Math.max(count, 1), maxRows) + SPARE

// Named from perun.grid_labels.<key>, as the grid names columns itself when it translates them.
const column = (t, key, extra) => ({
  key,
  name: t(`${labelBasePath}.grid_labels.${key.toLowerCase()}`),
  visible: true,
  editable: false,
  sortable: true,
  filterable: true,
  resizable: true,
  ...extra
})

const codes = (options) => ({ formatterType: 'DropDownFormatter', formatterOptions: options })

const LEVEL_OPTIONS = LEVELS.map((text, value) => ({ value, text }))

const ELLIPSIS = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const texts = (chips) => chips.map(chip => chip.text).join(', ')

const MAX_CHIPS = 2

const Chips = ({ chips, empty }) => {
  const t = useText()
  if (!chips?.length) return empty ? <span className='people-faint'>{t(empty)}</span> : null
  const more = chips.length - MAX_CHIPS
  return (
    <span className='people-chips' title={texts(chips)} style={{ display: 'flex', gap: 4, minWidth: 0, overflow: 'hidden' }}>
      {chips.slice(0, MAX_CHIPS).map(chip => (
        <span key={`${chip.kind}:${chip.text}`} className={`people-chip ${chip.kind}`} style={{ minWidth: 0 }}>
          <span style={ELLIPSIS}>{chip.text}</span>
        </span>
      ))}
      {more > 0 && <span className='people-chip more' style={{ flex: 'none' }}>+{more}</span>}
    </span>
  )
}

const AccessSources = ({ row }) => <Chips chips={row[`${ACCESS}.SOURCES`]} empty={row[`${ACCESS}.LEVEL`] ? undefined : 'perun.people.nothing_granted'} />

const GrantSources = ({ row }) => <Chips chips={row[`${GRANTS}.SOURCES`]} />

// A second value is shown, and goes into the cell's text to filter and export, only where it differs.
const withAside = (text, aside) => (aside && aside !== text ? `${text} (${aside})` : text)

const Aside = ({ text, aside, title }) => (
  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
    <span style={{ ...ELLIPSIS, flex: 'none', maxWidth: '100%' }}>{text}</span>
    {aside && aside !== text && <span className='people-aside' title={title} style={ELLIPSIS}>{aside}</span>}
  </span>
)

const TableCell = ({ row }) => {
  const t = useText()
  return (
    <Aside
      text={row[`${ACCESS}.LABEL`]}
      aside={row[`${ACCESS}.TABLE_NAME`]}
      title={t(`${labelBasePath}.grid_labels.${ACCESS.toLowerCase()}.table_name`)}
    />
  )
}

const ScopedCodeCell = ({ row }) => {
  const t = useText()
  return (
    <Aside
      text={row[`${GRANTS}.LABEL_CODE`]}
      aside={row[`${GRANTS}.CONFIG_KEY`]}
      title={t(`${labelBasePath}.grid_labels.${GRANTS.toLowerCase()}.config_key`)}
    />
  )
}

export const GroupActionsContext = createContext(null)

// The cell's clicks stop here: they are the buttons', not a row click.
const GroupActions = ({ row }) => {
  const t = useText()
  const actions = useContext(GroupActionsContext)
  if (!actions) return null
  const id = row[`${GROUPS}.PKID`]
  const isDefault = row[`${GROUPS}.MEMBERSHIP`] === 'DEFAULT'
  return (
    <span className='people-cell-actions' style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
      {/* Kept hidden on the default row so the Remove buttons line up. */}
      <button
        type='button'
        className='people-btn small'
        style={isDefault ? { visibility: 'hidden' } : undefined}
        aria-hidden={isDefault || undefined}
        tabIndex={isDefault ? -1 : undefined}
        disabled={isDefault || actions.busy || actions.self}
        onClick={() => actions.ask('default', id)}
      >
        {t('perun.people.make_default')}
      </button>
      <button
        type='button'
        className='people-btn small ghost danger'
        disabled={actions.busy || isDefault}
        title={isDefault ? t('perun.people.remove_default_hint') : undefined}
        onClick={() => actions.ask('remove', id)}
      >
        {t('perun.admin_console.remove')}
      </button>
    </span>
  )
}

export const peopleColumns = (t) => [
  column(t, `${PEOPLE}.NAME`, { isDefaultSort: true, defaultSortDirection: 'ASC' }),
  column(t, `${PEOPLE}.USER_NAME`),
  column(t, `${PEOPLE}.E_MAIL`),
  column(t, `${PEOPLE}.PIN`, { width: 130 }),
  column(t, `${PEOPLE}.USER_TYPE`, {
    width: 130,
    ...codes([{ value: 'INTERNAL', text: t('perun.people.internal') }, { value: 'EXTERNAL', text: t('perun.people.external') }])
  }),
  column(t, `${PEOPLE}.STATUS`, {
    width: 130,
    ...codes([{ value: 'VALID', text: t('perun.people.active') }, { value: 'INVALID', text: t('perun.people.disabled') }])
  })
]

export const peopleRows = (people) => people.map(person => ({
  [`${PEOPLE}.PKID`]: person.id,
  [`${PEOPLE}.NAME`]: fullName(person),
  [`${PEOPLE}.USER_NAME`]: person.userName,
  [`${PEOPLE}.E_MAIL`]: person.email,
  [`${PEOPLE}.PIN`]: person.pin,
  [`${PEOPLE}.USER_TYPE`]: person.type,
  [`${PEOPLE}.STATUS`]: person.status
}))

const grantSources = (grant, t) => (grant.direct
  ? [{ kind: 'direct', text: t('perun.people.direct') }]
  : grant.groups.map(group => ({ kind: 'group', text: group })))

export const accessColumns = (t) => [
  column(t, `${ACCESS}.TABLE`, { formatter: TableCell }),
  column(t, `${ACCESS}.LEVEL`, { width: 130, ...codes(LEVEL_OPTIONS) }),
  column(t, `${ACCESS}.THROUGH`, { width: '45%', formatter: AccessSources })
]

export const accessRows = (rows, { bypass, label, t }) => rows.map(row => {
  const sources = bypass
    ? [{ kind: 'admin', text: 'ADMINISTRATORS' }]
    : [
      ...row.groups.map(group => ({ kind: 'group', text: group })),
      ...(row.direct ? [{ kind: 'direct', text: t('perun.people.direct') }] : []),
      ...(row.scoped ? [{ kind: 'scoped', text: t('perun.people.scoped') }] : [])
    ]
  return {
    [`${ACCESS}.PKID`]: row.id,
    [`${ACCESS}.TABLE`]: withAside(label(row), row.name),
    [`${ACCESS}.LABEL`]: label(row),
    [`${ACCESS}.TABLE_NAME`]: row.name,
    [`${ACCESS}.LEVEL`]: row.level,
    [`${ACCESS}.THROUGH`]: texts(sources),
    [`${ACCESS}.SOURCES`]: sources
  }
})

export const grantColumns = (t) => [
  column(t, `${GRANTS}.LEVEL`, { width: 130, ...codes(LEVEL_OPTIONS) }),
  column(t, `${GRANTS}.CODE`),
  column(t, `${GRANTS}.THROUGH`, { formatter: GrantSources }),
  column(t, `${GRANTS}.EFFECT`)
]

export const grantRows = (row, t) => row.grants.map(grant => {
  const effect = grantEffect(grant, row)
  const sources = grantSources(grant, t)
  return {
    [`${GRANTS}.PKID`]: grant.aclId,
    [`${GRANTS}.LEVEL`]: grant.level,
    [`${GRANTS}.CODE`]: grant.labelCode,
    [`${GRANTS}.THROUGH`]: texts(sources),
    [`${GRANTS}.SOURCES`]: sources,
    [`${GRANTS}.EFFECT`]: t(`perun.people.effect_${effect}`, { key: grant.configKey }),
    additionalClassName: effect === 'sets' ? 'people-grant-sets' : undefined
  }
})

export const otherColumns = (t) => [
  column(t, `${GRANTS}.KIND`, { width: 170 }),
  column(t, `${GRANTS}.LEVEL`, { width: 130, ...codes(LEVEL_OPTIONS) }),
  column(t, `${GRANTS}.CODE`, { formatter: ScopedCodeCell }),
  column(t, `${GRANTS}.THROUGH`, { formatter: GrantSources })
]

export const otherRows = (matrix, t) => [...matrix.scoped, ...matrix.custom].map(grant => {
  const sources = grantSources(grant, t)
  return {
    [`${GRANTS}.PKID`]: grant.aclId,
    [`${GRANTS}.KIND`]: t(grant.configKey ? 'perun.people.other_scoped' : 'perun.people.other_custom'),
    [`${GRANTS}.LEVEL`]: grant.level,
    [`${GRANTS}.CODE`]: withAside(grant.labelCode, grant.configKey),
    [`${GRANTS}.LABEL_CODE`]: grant.labelCode,
    [`${GRANTS}.CONFIG_KEY`]: grant.configKey || '',
    [`${GRANTS}.THROUGH`]: texts(sources),
    [`${GRANTS}.SOURCES`]: sources
  }
})

export const groupColumns = (t) => [
  column(t, `${GROUPS}.GROUP_NAME`),
  column(t, `${GROUPS}.MEMBERSHIP`, {
    width: 150,
    ...codes([{ value: 'DEFAULT', text: t('perun.people.default') }, { value: 'ADDITIONAL', text: t('perun.people.additional') }])
  }),
  column(t, `${GROUPS}.ACTIONS`, { width: 230, sortable: false, filterable: false, resizable: false, formatter: GroupActions })
]

export const groupRows = (groups) => groups.map(group => ({
  [`${GROUPS}.PKID`]: group.id,
  [`${GROUPS}.GROUP_NAME`]: group.name,
  [`${GROUPS}.MEMBERSHIP`]: group.isDefault ? 'DEFAULT' : 'ADDITIONAL'
}))
