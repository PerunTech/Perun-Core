import React, { useEffect, useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse, ExportableGrid } from '../../../elements'
import { getGroupMembers } from '../People/peopleApi'
import { sortPeople } from '../People/people'
import { PEOPLE, peopleColumns, peopleRows } from '../People/grids'
import { useLabels } from '../People/ui'

const fileSafe = (text) => String(text).replace(/[^\w-]/g, '_')

// getLinkedUsers lists a default member again when they are an additional one too.
export const uniqueMembers = (people) => [...new Map(people.map(person => [String(person.id), person])).values()]

const GroupMembers = ({ svSession, group, openPerson }) => {
  const t = useLabels()
  const [members, setMembers] = useState(undefined)

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    getGroupMembers(svSession, group.id).then(list => {
      if (!cancelled) setMembers(sortPeople(uniqueMembers(list)))
    }).catch(err => {
      if (cancelled) return
      setMembers([])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, group.id])

  const columns = useMemo(() => peopleColumns(t), [t])
  const rows = useMemo(() => (members ? peopleRows(members) : []), [members])

  if (members === undefined) return <p className='people-empty'>{t('perun.people.loading')}</p>

  return (
    <div className='people-group-members'>
      <p className='people-note'>{t('perun.groups.members_note')}</p>
      {members.length
        ? (
          <ExportableGrid
            id={`MEMBERS_${fileSafe(group.name)}`}
            gridType='SEARCH_GRID_DATA'
            configTableName={columns}
            dataTableName={rows}
            heightRatio={0.5}
            onRowClickFunct={(_grid, _rowIdx, row) => openPerson(row[`${PEOPLE}.PKID`])}
          />
        )
        : <p className='people-empty'>{t('perun.groups.no_members', { group: group.name })}</p>}
    </div>
  )
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
})

export default connect(mapStateToProps)(GroupMembers)
