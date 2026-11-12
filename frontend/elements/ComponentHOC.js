import React from 'react';
import { connect } from 'react-redux';
import { ReducerTemplater, ComponentManager } from '.';
import { dataToRedux, publishState, store, injectAsyncReducer, removeAsyncReducer } from '../model';

// The reducer is named by the component's props.id, else by the id given here.
export function WrapItUp(ComposedComponent, typeOfComponent, id, isPersistent, storeKeys) {
  const mapStateToProps = (state, ownProps) => {
    let dynamicReducerName = ownProps.id
    if (dynamicReducerName === null || dynamicReducerName === undefined) { dynamicReducerName = id }
    const reducer = state[dynamicReducerName]

    const obj = {}
    if (reducer !== null) {
      for (const key in reducer) {
        const value = reducer[key]
        obj[key] = value
      }
    }
    if (ComponentManager.isComponentRegistered(dynamicReducerName)) {
      if (state.componentIndex[dynamicReducerName].listener !== null && state.componentIndex[dynamicReducerName].listener !== undefined) {
        const listener = state.componentIndex[dynamicReducerName].listener
        for (const key in listener) {
          const value = listener[key]
          if (value === null || value === undefined) {
            obj[key] = state[key]
          } else {
            const valToEnter = state[key][value]
            const keyToEnter = `${key}.${value}`
            obj[keyToEnter] = valToEnter
          }
        }
      }
    }

    return obj
  }
  class EnhancedComponent extends React.Component {
    constructor(props) {
      super(props)
      this.childDidMount = this.childDidMount.bind(this)
      this.publishMe = this.publishMe.bind(this)
    }

    UNSAFE_componentWillMount() {
      let finalId
      if (this.props.id === null || this.props.id === undefined) {
        finalId = id
      } else {
        finalId = this.props.id
      }
      const varReducer = ReducerTemplater.generateReducerFromTemplate(typeOfComponent, finalId)
      injectAsyncReducer(store, finalId, varReducer)
      ComponentManager.registerComponent(finalId, typeOfComponent, isPersistent, storeKeys)
    }

    componentWillUnmount() {
      if (!isPersistent) {
        let finalId
        if (!this.props.id) {
          finalId = id
        } else {
          finalId = this.props.id
        }
        if (store.getState()[finalId]) {
          removeAsyncReducer(store, finalId)
        }
      }
    }

    publishMe(finalId, props) {
      if (typeOfComponent === 'GenericGrid') {
        store.dispatch(publishState(finalId, props))
      } else if (typeOfComponent === 'genericComponent') {
        dataToRedux(null, id, 'FULL_STATE', props)
      } else if (typeOfComponent === 'GenericForm') {
        store.dispatch(publishState(finalId, props))
      }
    }
    childDidMount(child) {
      if (child !== null && child !== undefined) {
        const stateToSend = child.state
        this.publishMe(this.props.id, stateToSend)
      }
    }

    render() {
      const svsession = store.getState().security.svSession
      return <ComposedComponent {...this.props} session={svsession} refFunction={this.childDidMount} />
    }
  }

  return connect(mapStateToProps)(EnhancedComponent)
}