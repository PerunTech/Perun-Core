import React, { useEffect, useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse, ExportableGrid, Icon } from '../../../elements'
import { getGroupRows } from '../People/peopleApi'
import { useAclData } from '../People/useAclData'
import { sameId } from '../People/people'
import { useLabels } from '../People/ui'
import { USER_GROUPS, groupListColumns, groupListRows, sortByName, toGroupRecord } from './groupGrids'
import GroupPage from './GroupPage'
import GroupDetails from './GroupDetails'

// The list stays mounted under an open group, so its filters and scroll are still there on the way back.
const GroupsSection = ({ svSession, id, tab, navigate, openPerson }) => {
  const t = useLabels()
  const acl = useAclData(svSession)
  const [groups, setGroups] = useState(undefined)
  const [reload, setReload] = useState(0)
  const [opening, setOpening] = useState(null)

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getGroupRows(svSession).then(rows => {
      if (!cancelled) setGroups(sortByName(rows.map(toGroupRecord)))
    }).catch(err => {
      if (cancelled) return
      setGroups(current => current || [])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, reload])

  useEffect(() => {
    if (!opening || !groups) return
    const created = groups.find(group => group.name.toUpperCase() === opening)
    if (created) {
      setOpening(null)
      navigate(created.id, 'permissions')
    }
  }, [opening, groups, navigate])

  const columns = useMemo(() => groupListColumns(t), [t])
  const ready = groups && (acl.data || acl.failed)
  const rows = useMemo(() => (ready ? groupListRows(groups, acl.data) : undefined), [ready, groups, acl.data])
  const group = groups?.find(each => sameId(each.id, id))

  const saved = () => {
    setReload(count => count + 1)
    acl.reload()
  }
  const created = (name) => {
    setOpening(String(name || '').toUpperCase())
    saved()
  }

  const main = () => {
    if (id === 'new') return <GroupDetails onSaved={created} onCancel={() => navigate()} />
    if (group) {
      return (
        <GroupPage
          key={group.id}
          group={group}
          tab={tab}
          acl={acl}
          navigate={(nextTab) => navigate(group.id, nextTab)}
          openPerson={openPerson}
          onSaved={saved}
        />
      )
    }
    if (groups === undefined) return <p className='people-empty'>{t('perun.people.loading')}</p>
    return <p className='people-empty'>{t('perun.groups.not_found')}</p>
  }

  return (
    <div className='people people-groups'>
      <section className='people-list' aria-label={t('perun.user_mng_groups')} style={id ? { display: 'none' } : undefined}>
        {rows
          ? (
            <ExportableGrid
              id={USER_GROUPS}
              gridType='SEARCH_GRID_DATA'
              configTableName={columns}
              dataTableName={rows}
              heightRatio={0.65}
              onRowClickFunct={(_grid, _rowIdx, row) => navigate(row[`${USER_GROUPS}.PKID`])}
              toggleCustomButton
              customButton={() => navigate('new')}
              customButtonLabel={t('perun.groups.new')}
              customButtonClassName='people-new-button'
            />
          )
          : <p className='people-empty'>{t('perun.people.loading')}</p>}
      </section>
      {id && (
        <section className='people-main'>
          <button type='button' className='people-back' onClick={() => navigate()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name='IconArrowLeft' size={16} aria-hidden='true' />
            <span>{t('perun.groups.back')}</span>
          </button>
          {main()}
        </section>
      )}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(GroupsSection)
