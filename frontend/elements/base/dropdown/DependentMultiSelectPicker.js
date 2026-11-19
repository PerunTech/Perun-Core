import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { connect } from 'react-redux';
import { alertUserResponse } from '../..';
import { store, publishState } from '../../../model';
import { Loading } from '../../../components/ComponentsIndex';
import GenericGrid from '../../grid/GenericGrid';
import { pkidKey } from '../../grid/logic/rows';
import { HEADER_ROW_HEIGHT, ROW_HEIGHT } from '../../grid/body/layout';
import { getDynamicKey } from '../../../functions/utils';

const PLACEHOLDER = /\{([^}]+)\}/g
// Room for a horizontal scrollbar, so a short grid doesn't scroll vertically as well
const SPARE = 18

const isEmpty = (value) => value === undefined || value === null || value === ''

// A url with each {FIELD} taken from the row; null while one of them is empty
export const resolveUrl = (template, row) => {
  if (!template) return null
  let missing = false
  const url = template.replace(PLACEHOLDER, (_, field) => {
    if (isEmpty(row?.[field])) missing = true
    return encodeURIComponent(row?.[field] ?? '')
  })
  return missing ? null : url
}

const rowsOf = (data) => (Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])

// The grid's filter inputs sit inside the form, where Enter would submit it
const keepEnter = (event) => {
  if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault()
}

// The rows of dataUrl need a <TABLE>.PKID: the grid keys its selection by it
const DependentMultiSelectPicker = (props) => {
  const { id, value, onChange, disabled, readonly, options, uiSchema, url, fieldListUrl, sourceValue } = props
  const { valueField, selectAllByDefault, maxRows = 8 } = uiSchema || {}
  const [gridId] = useState(() => `${id}_${getDynamicKey()}`)
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const loadedFor = useRef()
  const selectionFor = useRef([])
  const shownRows = useRef(rows)
  shownRows.current = rows
  const selected = Array.isArray(value) ? value : []
  const locked = disabled || readonly

  useEffect(() => {
    const first = loadedFor.current === undefined
    loadedFor.current = url
    if (!url) {
      setRows(null)
      setLoading(false)
      // A new row has nothing to clear, and an onChange there would race rjsf's add-item onChange and drop the row
      if (!selected.length) return
      // The store has the source's change before rjsf does; an onChange in this pass would hand back rjsf's older copy
      const timer = setTimeout(() => onChange([]))
      return () => clearTimeout(timer)
    }
    let cancelled = false
    setLoading(true)
    axios.get(`${window.server}${url}`).then((response) => {
      if (cancelled) return
      const list = rowsOf(response?.data)
      // What the row already holds when the picker mounts is kept, e.g. after a remount
      const keep = first && selected.length
      const next = keep ? selected : selectAllByDefault ? list.map((row) => row[valueField]) : []
      selectionFor.current = next
      setRows(list)
      if (!keep && (next.length || selected.length)) onChange(next)
    }).catch((error) => {
      if (cancelled) return
      console.error(error)
      selectionFor.current = []
      setRows([])
      alertUserResponse({ response: error })
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
    // Only on a change of the source: onChange's identity isn't stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, sourceValue])

  // The grid clears its selection when its rows change, in its own effect, which runs before this one
  useEffect(() => {
    if (!rows || locked) return
    const chosen = new Set(selectionFor.current)
    const key = pkidKey(rows)
    const picked = rows.filter((row) => chosen.has(row[valueField]))
    store.dispatch(publishState(gridId, { selectedKeys: picked.map((row) => row[key]), selectedRowData: picked }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // In the list's order, which also drops values the list no longer has
  const onSelect = (selectedRowData) => {
    const chosen = new Set(selectedRowData.map((row) => row[valueField]))
    onChange((shownRows.current || []).map((row) => row[valueField]).filter((v) => chosen.has(v)))
  }

  const chosen = new Set(selected)
  const data = rows && (locked ? rows.filter((row) => chosen.has(row[valueField])) : rows)

  return (
    <div className='dependent-multi-select-picker' id={id} onKeyDown={keepEnter}>
      {loading && <Loading />}
      {!url && options?.placeholder && <p className='dependent-multi-select-picker-note'>{options.placeholder}</p>}
      {url && data && fieldListUrl && (
        <GenericGrid
          id={gridId}
          gridType='SEARCH_GRID_DATA'
          configTableName={fieldListUrl}
          dataTableName={data}
          enableMultiSelect={!locked}
          onSelectChangeFunct={onSelect}
          minHeight={HEADER_ROW_HEIGHT + ROW_HEIGHT * Math.min(Math.max(data.length, 1), maxRows) + SPARE}
        />
      )}
    </div>
  )
}

// Read from the store, not ownProps: rjsf's SchemaField redraws only when its own field changes, so it
// wouldn't redraw this widget when the field it depends on changes.
function mapStateToProps(state, ownProps) {
  const { formId, rowPath, uiSchema } = ownProps
  const { dependentOnField, dataUrl, fieldListUrl } = uiSchema || {}
  const row = (rowPath || []).reduce((node, key) => node?.[key], state[formId]?.formTableData)
  const sourceValue = dependentOnField ? row?.[dependentOnField] : undefined
  const waiting = dependentOnField && isEmpty(sourceValue)
  return {
    sourceValue,
    url: waiting ? null : resolveUrl(dataUrl, row),
    fieldListUrl: resolveUrl(fieldListUrl, row)
  }
}

export default connect(mapStateToProps)(DependentMultiSelectPicker)
