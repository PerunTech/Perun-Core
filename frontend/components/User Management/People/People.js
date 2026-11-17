import React, { useEffect, useMemo, useState } from 'react'
import { connect } from 'react-redux'
import { alertUserResponse, ExportableGrid, Icon } from '../../../elements'
import { listPeople } from './peopleApi'
import { sameId, sortPeople } from './people'
import { PEOPLE, USERS_LIST, peopleColumns, peopleRows } from './grids'
import { useLabels } from './ui'
import PersonPage from './PersonPage'
import NewPerson from './NewPerson'

// The list stays mounted under an open person, so its filters and scroll are still there on the way back.
const People = ({ svSession, id, tab, navigate }) => {
  const t = useLabels()
  const [people, setPeople] = useState(undefined)
  const [reload, setReload] = useState(0)
  const [opening, setOpening] = useState(null)

  useEffect(() => {
    if (!svSession) return
    let cancelled = false
    listPeople(svSession).then(list => {
      if (!cancelled) setPeople(sortPeople(list))
    }).catch(err => {
      if (cancelled) return
      setPeople(current => current || [])
      alertUserResponse({ response: err })
    })
    return () => { cancelled = true }
  }, [svSession, reload])

  useEffect(() => {
    if (!opening || !people) return
    const created = people.find(person => person.userName.toUpperCase() === opening)
    if (created) {
      setOpening(null)
      navigate(created.id, 'groups')
    }
  }, [opening, people, navigate])

  const columns = useMemo(() => peopleColumns(t), [t])
  const rows = useMemo(() => (people ? peopleRows(people) : undefined), [people])
  const person = people?.find(item => sameId(item.id, id))

  const onCreated = (userName) => {
    setOpening(String(userName || '').toUpperCase())
    setReload(count => count + 1)
  }
  const onChange = (updated) => setPeople(list => list.map(item => (sameId(item.id, updated.id) ? updated : item)))

  const main = () => {
    if (id === 'new') return <NewPerson onCreated={onCreated} onCancel={() => navigate()} />
    if (person) {
      return (
        <PersonPage
          key={person.id}
          person={person}
          tab={tab}
          navigate={(nextTab) => navigate(person.id, nextTab)}
          onChange={onChange}
          onSaved={() => setReload(count => count + 1)}
        />
      )
    }
    if (people === undefined) return <p className='people-empty'>{t('perun.people.loading')}</p>
    return <p className='people-empty'>{t('perun.people.not_found')}</p>
  }

  return (
    <div className='people'>
      <section className='people-list' aria-label={t('perun.people.title')} style={id ? { display: 'none' } : undefined}>
        {rows
          ? (
            <ExportableGrid
              id={USERS_LIST}
              gridType='SEARCH_GRID_DATA'
              configTableName={columns}
              dataTableName={rows}
              heightRatio={0.65}
              onRowClickFunct={(_grid, _rowIdx, row) => navigate(row[`${PEOPLE}.PKID`])}
              toggleCustomButton
              customButton={() => navigate('new')}
              customButtonLabel={t('perun.people.new')}
              customButtonClassName='people-new-button'
            />
          )
          : <p className='people-empty'>{t('perun.people.loading')}</p>}
      </section>
      {id && (
        <section className='people-main'>
          <button type='button' className='people-back' onClick={() => navigate()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name='IconArrowLeft' size={16} aria-hidden='true' />
            <span>{t('perun.people.back')}</span>
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

export default connect(mapStateToProps)(People)
