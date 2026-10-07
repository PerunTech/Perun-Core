import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { Icon } from '../../../elements'
import getMetadataSchema, { transformMetadataErrors } from '../../MarkdownEditor/metadataSchema'
import RouteWidget from '../../MarkdownEditor/RouteWidget'

/**
 * The form shown over a chosen file, for both things a file can be.
 *
 * One dialog rather than two, because to an author the gesture is the same: this is the file, here
 * is where it goes. What differs is only what the file turns into, which is the caller's business,
 * so the only thing read of `importing` here is its metadata and the wording.
 */

// The editor's own metadata strip lays these out in a row; here they sit on a grid, so the classes
// differ while the fields and their widgets do not.
const uploadUiSchema = (routes, fmt) => ({
  'ui:order': ['route', 'title', 'locale', 'slug', 'order'],
  route: {
    'ui:classNames': 'user-guides-field user-guides-field--wide',
    'ui:widget': RouteWidget,
    'ui:options': { routes, toggleLabel: fmt('perun.help_editor.show_routes') },
  },
  title: { 'ui:classNames': 'user-guides-field user-guides-field--wide' },
  locale: { 'ui:classNames': 'user-guides-field' },
  slug: { 'ui:classNames': 'user-guides-field' },
  order: { 'ui:classNames': 'user-guides-field' },
})

/** A file size a person reads rather than a byte count, for the chosen manual. */
const fileSize = (bytes) => {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const GuideUploadDialog = ({
  file, importing, routes, locales, saving, fmt, intlContext, onPickOther, onCancel, onSubmit,
}) => {
  const schema = useMemo(
    () => getMetadataSchema(intlContext, { locales, routes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locales, routes]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uiSchema = useMemo(() => uploadUiSchema(routes, fmt), [routes])

  /**
   * A slug seeded from the chosen file, since a manual usually arrives already named.
   *
   * The schema's slug pattern is strict, so the file name is folded to fit it rather than offered
   * as-is and rejected on submit.
   */
  const defaults = useMemo(() => {
    const stem = (file?.name ?? '').replace(/\.(pdf|md|zip)$/i, '')
    // An imported guide states its own route and title in its front matter and its locale and slug
    // in its file name, so the form opens on what the document says. Offered only as a default:
    // a route or locale this deployment does not have falls back rather than seeding a value the
    // schema would reject, and the form is shown for review before any of it is stored.
    const meta = importing?.meta ?? {}
    const doc = importing?.doc
    const offered = (value, options) =>
      (options.some(option => option.value === value) ? value : options[0]?.value ?? '')

    return {
      // Kept as written rather than run through `offered`: the route field takes free text now, so
      // an imported guide routed by a pattern would otherwise be quietly moved to the first module
      // in the list. Only an empty route falls back.
      route: meta.route || routes[0]?.value || '',
      locale: offered(doc?.locale, locales),
      order: Number(meta.order) || 1,
      slug: doc?.slug ?? stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      title: meta.title || stem,
    }
  }, [routes, locales, file, importing])

  return (
    <section className='user-guides-upload' aria-label={fmt('perun.admin_console.user_guides_upload')}>
      <header className='user-guides-upload-head'>
        <h3>{fmt(importing ? 'perun.admin_console.user_guides_import' : 'perun.admin_console.user_guides_upload')}</h3>
        <button
          type='button'
          className='user-guides-upload-close'
          title={fmt('perun.help_editor.cancel')}
          aria-label={fmt('perun.help_editor.cancel')}
          onClick={onCancel}
        >
          <Icon name='IconX' size={16} stroke={1.7} />
        </button>
      </header>

      <p className='user-guides-upload-file'>
        <Icon name={importing ? 'IconFileText' : 'IconFileTypePdf'} size={22} stroke={1.5} />
        <span className='user-guides-upload-name'>{file.name}</span>
        <span className='user-guides-upload-size'>{fileSize(file.size)}</span>
        <button type='button' className='user-guides-upload-swap' onClick={onPickOther}>
          {fmt('perun.admin_console.user_guides_choose_other')}
        </button>
      </p>

      <p className='user-guides-upload-hint'>{fmt('perun.admin_console.user_guides_upload_hint')}</p>

      <Form
        schema={schema.schema}
        uiSchema={uiSchema}
        formData={defaults}
        validator={validator}
        transformErrors={errors => transformMetadataErrors(errors, intlContext)}
        showErrorList={false}
        noHtml5Validate
        className='user-guides-upload-form'
        onSubmit={({ formData }) => onSubmit(formData)}
      >
        <div className='user-guides-upload-actions'>
          <button type='button' className='md-btn md-btn--ghost' onClick={onCancel}>
            {fmt('perun.help_editor.cancel')}
          </button>
          <button type='submit' className='md-btn md-btn--primary' disabled={saving}>
            <Icon name='IconUpload' size={16} stroke={1.7} />
            <span>{fmt(importing ? 'perun.admin_console.user_guides_import' : 'perun.admin_console.user_guides_upload')}</span>
          </button>
        </div>
      </Form>
    </section>
  )
}

GuideUploadDialog.propTypes = {
  file: PropTypes.object.isRequired,
  // The read guide when this is an import, absent when a PDF manual is being uploaded as it stands.
  importing: PropTypes.object,
  routes: PropTypes.array.isRequired,
  locales: PropTypes.array.isRequired,
  saving: PropTypes.bool,
  fmt: PropTypes.func.isRequired,
  // The legacy intl context, which the schema and its error messages are built from.
  intlContext: PropTypes.object.isRequired,
  onPickOther: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

export default GuideUploadDialog
