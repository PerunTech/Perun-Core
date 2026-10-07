import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import getMetadataSchema, { transformMetadataErrors } from './metadataSchema';

/**
 * The strip above the editor: where the document goes, and what it will be called.
 *
 * Builds its own schema from the locales and routes on offer, the way the upload dialog does, so
 * the two surfaces that ask for a guide's metadata ask for it the same way and neither the editor
 * nor the Admin Console screen has to carry RJSF.
 *
 * Carries the form id the toolbar's Save submits against, which is what lets a button outside the
 * form drive it and still get RJSF's validation first.
 */
const MarkdownMetaForm = ({ formId, form, locales, routes, intlContext, fmt, onChange, onSubmit }) => {
  const { schema, uiSchema } = useMemo(
    () => getMetadataSchema(intlContext, { locales, routes }),
    // intlContext is the legacy intl container and is stable for a given locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locales, routes]
  );

  const transformErrors = useCallback(
    (errors) => transformMetadataErrors(errors, intlContext),
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
        {/* Suppresses RJSF's own submit button; the toolbar's Save submits by form id. */}
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
  // The legacy intl context, which the schema and its error messages are built from.
  intlContext: PropTypes.object.isRequired,
  fmt: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default MarkdownMetaForm;
