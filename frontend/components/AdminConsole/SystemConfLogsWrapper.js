import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'
import { connect } from 'react-redux';
import { ComponentManager } from '../../elements';

const SvarogNotesWrapper = (props, context) => {
    const [shouldRender, setRender] = useState(false)
    useEffect(() => {
        changeField()
    }, [])

    const changeField = () => {
        const { formid } = props
        const jsonSchema = ComponentManager.getStateForComponent(formid, "formData");
        if (jsonSchema) {
            delete jsonSchema.properties['NOTE_TEXT'].format
            ComponentManager.setStateForComponent(formid, "formData", jsonSchema);
            props.formInstance.setState({ formData: jsonSchema });
            setRender(true)
        }
    }

    if (!shouldRender) return null

    const { formid } = props
    const formDataLoaded = ComponentManager.getStateForComponent(formid, 'formDataLoaded')
    const formTableData = ComponentManager.getStateForComponent(formid, 'formTableData')

    if (formDataLoaded === true && !formTableData?.NOTE_TEXT) {
        return (
            <p className='conf-log-no-data'>
                {context.intl.formatMessage({ id: 'perun.admin_console.no_log_to_show', defaultMessage: 'perun.admin_console.no_log_to_show' })}
            </p>
        )
    }

    return <>{props.children}</>
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

SvarogNotesWrapper.contextTypes = {
    intl: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(SvarogNotesWrapper);
