import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { connect } from 'react-redux';
import { ComponentManager, alertUserResponse } from '../..';
import { Loading } from '../../../components/ComponentsIndex';

// Generic rjsf widget: value mirrors an attribute off whatever codelist row
// is currently selected on another field. The attribute looked up is this
// widget's own field name (see GenericForm's DependentValueField wrapper,
// which passes it as attributeName), so uiSchema only needs to declare
// `dependentOnField`.
//
// Two backend strategies, picked by whether `codelistName` is set on the
// field's uiSchema entry:
// - not set: value comes from `dependentFieldData`, which DependentElements.js
//   already publishes from the codelist fetch it makes for `dependentOnField`
//   itself, no extra request.
// - set: the derived value lives on a separate codelist (e.g. accreditation
//   flags keyed by METHOD code, not a column on METHOD's own codelist rows),
//   fetched from the dedicated getDependentFieldValue endpoint instead.
const DependentValueField = (props) => {
  const { id, label, formId, svSession, dependentOnField, codelistName, attributeName, sourceValue, onChange, schema, value, disabled, readonly } = props
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dependentOnField) return

    if (codelistName) {
      // Nothing to look up yet: on a freshly-added array row, sourceValue and
      // value are both still empty, and firing onChange here races with
      // rjsf's own add-item onChange (ArrayField.onChangeForIndex maps over
      // its own formData prop, which doesn't include the new row yet),
      // silently dropping the row that was just added.
      if (!sourceValue) {
        if (value !== undefined) onChange(undefined)
        return
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
      // Drop a stale response if sourceValue changes again (or the widget
      // unmounts) before this request resolves.
      return () => { cancelled = true }
    }

    const dataByField = ComponentManager.getStateForComponent(formId, 'dependentFieldData') || {}
    const row = dataByField[dependentOnField]?.[sourceValue]
    const derivedValue = row ? row[attributeName] : undefined
    if (derivedValue === value) return
    onChange(derivedValue)
    // Only resync when the source field's value actually changes, not on every
    // parent re-render (onChange's identity isn't stable across renders here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceValue])

  const isDisabled = disabled || readonly
  if (schema?.type === 'boolean') {
    // Matches rjsf's own CheckboxWidget markup, so this renders identically to
    // a default boolean field (the outer form-group/field wrapper comes from
    // rjsf's field template, applied to any widget, not from here).
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

// sourceValue is read straight from the form's redux slice here, rather than
// threaded down as an ownProp, because @rjsf/core's SchemaField has its own
// shouldComponentUpdate (a deepEquals on its own props) that only fires when
// THIS field's own formData/schema/etc change. It has no idea this widget
// also depends on a sibling field, so when e.g. METHOD changes, IS_TEST_ACCREDITED's
// SchemaField sees no relevant prop change and skips re-rendering entirely,
// this widget would never be re-invoked with a fresh sourceValue. Connecting
// directly to redux sidesteps that: connect() subscribes to the store on its
// own and re-renders this component whenever formTableData changes, independent
// of whether any ancestor (including SchemaField) decided to re-render.
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
