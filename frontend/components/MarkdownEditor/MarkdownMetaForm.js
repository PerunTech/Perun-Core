import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import getMetadataSchema, { transformMetadataErrors } from './metadataSchema';

const MarkdownMetaForm = ({ formId, form, locales, routes, intl, fmt, onChange, onSubmit }) => {
  const { schema, uiSchema } = useMemo(
    () => getMetadataSchema(intl, { locales, routes }),
    // intl is stable for a given locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locales, routes]
  );

  const transformErrors = useCallback(
    (errors) => transformMetadataErrors(errors, intl),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className='md-meta'>
      <Form
        id={formId}
        schema={schema}
        uiSchema={uiSchema}
        formData={form}
        validator={validator}
        transformErrors={transformErrors}
        showErrorList={false}
        noHtml5Validate
        onChange={onChange}
        onSubmit={onSubmit}
        className='md-meta-form'
      >
        {/* Hides RJSF's own submit button; the toolbar's Save submits by form id. */}
        <></>
      </Form>
      <div className='md-saves-as'>
        <span>{fmt('perun.help_editor.saves_as')}</span>
        <code>{form.locale && form.slug ? `${form.locale}_${form.slug}.md` : '--'}</code>
      </div>
    </div>
  );
};

MarkdownMetaForm.propTypes = {
  formId: PropTypes.string.isRequired,
  form: PropTypes.object.isRequired,
  locales: PropTypes.array,
  routes: PropTypes.array,
  intl: PropTypes.object.isRequired,
  fmt: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default MarkdownMetaForm;
