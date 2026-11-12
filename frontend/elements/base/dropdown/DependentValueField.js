import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { connect } from 'react-redux';
import { ComponentManager, alertUserResponse } from '../..';
import { Loading } from '../../../components/ComponentsIndex';

// Mirrors an attribute (this field's name) of the row picked on dependentOnField. Without codelistName
// it reads the rows DependentElements publishes; with one, it asks getDependentFieldValue.
const DependentValueField = (props) => {
  const { id, label, formId, svSession, dependentOnField, codelistName, attributeName, sourceValue, onChange, schema, value, disabled, readonly } = props
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dependentOnField) return

    // sourceValue comes from the store, which a dependency dropdown updates before rjsf takes the new
    // form data; an onChange in this same pass would hand back rjsf's older copy and undo that change
    const later = (next) => {
      const timer = setTimeout(() => onChange(next))
      return () => clearTimeout(timer)
    }

    if (codelistName) {
      // Nothing to look up on a new array row, and an onChange here would race rjsf's add-item
      // onChange and drop the row.
      if (!sourceValue) {
        return value !== undefined ? later(undefined) : undefined
      }
      let cancelled = false
      setLoading(true)
      const wsPath = `ReactElements/getDependentFieldValue/sid/${svSession}/codelist-name/${codelistName}/parent-code-value/${sourceValue}/attribute/${attributeName}`
      axios.get(`${window.server}/${wsPath}`).then((response) => {
        if (cancelled) return
        const derivedValue = response?.data?.data?.value
        if (derivedValue !== value) onChange(derivedValue)
      }).catch((error) => {
        console.error(error)
        alertUserResponse({ response: error })
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
      // Drops a stale response.
      return () => { cancelled = true }
    }

    const dataByField = ComponentManager.getStateForComponent(formId, 'dependentFieldData') || {}
    const row = dataByField[dependentOnField]?.[sourceValue]
    const derivedValue = row ? row[attributeName] : undefined
    if (derivedValue === value) return
    return later(derivedValue)
    // Only on a change of the source value: onChange's identity isn't stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceValue])

  const isDisabled = disabled || readonly
  if (schema?.type === 'boolean') {
    // rjsf's CheckboxWidget markup, so it looks like a default boolean field.
    return (
      <React.Fragment>
        {loading && <Loading />}
        <div className={`checkbox ${isDisabled ? 'disabled' : ''}`}>
          <label>
            <input
              type='checkbox'
              id={id}
              name={id}
              checked={!!value}
              disabled={isDisabled}
              aria-describedby={`${id}__error ${id}__description ${id}__help`}
            />
            <span>{label}</span>
          </label>
        </div>
      </React.Fragment>
    )
  }
  return (
    <React.Fragment>
      {loading && <Loading />}
      <input id={id} type='text' className='form-control' value={value ?? ''} disabled={isDisabled} readOnly />
    </React.Fragment>
  )
}

// Read from the store, not ownProps: rjsf's SchemaField redraws only when its own field changes, so it
// wouldn't redraw this widget when the sibling it depends on changes.
function mapStateToProps(state, ownProps) {
  const { formId, rowPath, arrayIndex, dependentOnField } = ownProps
  const formTableData = state[formId]?.formTableData
  const path = rowPath ?? (arrayIndex !== undefined ? [arrayIndex] : [])
  const rowData = path.reduce((node, key) => node?.[key], formTableData)
  return {
    svSession: state.security.svSession,
    sourceValue: rowData?.[dependentOnField]
  }
}

export default connect(mapStateToProps)(DependentValueField)
