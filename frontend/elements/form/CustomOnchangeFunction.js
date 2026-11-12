import React from 'react';
import SchemaField from '@rjsf/core/lib/components/fields/SchemaField';

export const CustomOnchangeFunction = function (props) {

    const customProps = {};

    // Fields only, not the parent object.
    if (props.name) {

        const formContext = props.registry.formContext;

        const { onChange, name } = props;

        customProps.onChange = function (fieldData) {

            if (formContext && formContext.onFieldChange &&
                typeof formContext.onFieldChange === 'function') {

                formContext.onFieldChange(name, fieldData);
            }

            onChange(fieldData);
        };

    }

    return (
        <SchemaField {...props} {...customProps} />
    );
};

