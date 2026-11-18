import React, { useState } from 'react'
import { connect } from 'react-redux'
import axios from 'axios'
import { alertUserResponse, Icon } from '../../../elements'
import { downloadJson, fetchInBatches } from '../../AdminConsole/SvarogTables/svarogTableUtils'
import { useLabels } from '../People/ui'
import GroupPermissions from './GroupPermissions'
import GroupMembers from './GroupMembers'
import GroupDetails from './GroupDetails'

const TABS = [
  ['permissions', 'perun.groups.tab_permissions'],
  ['members', 'perun.groups.tab_members'],
  ['details', 'perun.groups.tab_details']
]

const EXPORT_BATCH = 20

const toItems = (data) => (Array.isArray(data) ? data : data ? [data] : [])

// The group with its ACLs nested as an ACLS value, as SvarogInstall's setVal(Sv.ACLS, acls) reads them back.
const exportGroup = async (svSession, groupId, aclIds) => {
  const [groupRes, aclResults] = await Promise.all([
    axios.get(`${window.server}/WsCore/object/${svSession}/${groupId}/SVAROG_USER_GROUPS`),
    fetchInBatches(aclIds, EXPORT_BATCH, id => axios.get(`${window.server}/WsCore/object/${svSession}/${id}/SVAROG_ACL`))
  ])
  const acls = aclResults.flatMap(res => toItems(res?.data))
  const items = toItems(groupRes?.data)
  const groupObject = items[0]?.['com.prtech.svarog_common.DbDataObject']
  if (groupObject) {
    groupObject.values = [
      ...(groupObject.values || []),
      { ACLS: { 'com.prtech.svarog_common.DbDataArray': { indexField: null, filter: null, items: acls, idxItems: [] } } }
    ]
  }
  return { 'com.prtech.svarog_common.DbDataArray': { indexField: null, filter: null, items, idxItems: [] } }
}

const GroupPage = ({ svSession, group, tab, acl, navigate, openPerson, onSaved }) => {
  const t = useLabels()
  const [exporting, setExporting] = useState(false)
  const current = TABS.some(([key]) => key === tab) ? tab : 'permissions'
  const codeIds = acl.data ? [...new Set(acl.data.holders.bySid.get(String(group.id)) || [])] : null

  const download = () => {
    setExporting(true)
    exportGroup(svSession, group.id, codeIds)
      .then(data => downloadJson(data, group.name || 'GROUP_ACL_EXPORT'))
      .catch(err => alertUserResponse({ response: err }))
      .finally(() => setExporting(false))
  }

  return (
    <article className='people-person people-group'>
      <header className='people-person-head' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span className='people-avatar large square' aria-hidden='true'>{group.name.slice(0, 2)}</span>
        <div className='people-person-title' style={{ flex: 1, minWidth: 200 }}>
          <h3>{group.name}</h3>
          <div className='people-person-meta' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {group.type && <span className='people-chip'>{group.type}</span>}
            {group.securityType && <span className='people-chip'>{group.securityType}</span>}
            {group.email && <span>{group.email}</span>}
            {codeIds && <span>{t('perun.groups.code_count', { count: codeIds.length })}</span>}
          </div>
        </div>
        <button
          type='button'
          className='people-btn ghost'
          disabled={exporting || !codeIds}
          onClick={download}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name='IconDownload' size={16} aria-hidden='true' />
          <span>{t('perun.admin_console.export_group_acl')}</span>
        </button>
      </header>
      <div className='people-tabs' role='tablist' style={{ display: 'flex', flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={current === key}
            className={`people-tab${current === key ? ' on' : ''}`}
            onClick={() => navigate(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className='people-tab-body' role='tabpanel'>
        {current === 'permissions' && <GroupPermissions group={group} acl={acl} />}
        {current === 'members' && <GroupMembers group={group} openPerson={openPerson} />}
        {current === 'details' && <GroupDetails groupId={group.id} onSaved={onSaved} />}
      </div>
    </article>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(GroupPage)
