import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';
import { Icon } from '../../elements';
import Loading from '../Loading/Loading';
import MarkdownMetaForm from './MarkdownMetaForm';
import MarkdownPreview from './MarkdownPreview';
import MarkdownToolbar from './MarkdownToolbar';
import { useScrollSync } from './useScrollSync';
import { useEditorFigures } from './useEditorFigures';
import { parseFrontMatter, serializeFrontMatter } from '../../elements/guides/frontMatter';
import {
  EDITOR_OPTIONS, wrapSelection, prefixLines, toSlug, formatStats,
} from './utils';

// Rendering the preview costs a full marked parse plus a DOMPurify pass over the whole document,
// which is far too much to repeat on every keystroke of a long manual. The buffer stays instant;
// the preview and the stats readout trail it. Matches the 200ms the JSON editor debounces at.
// RJSF's Form.submit() dispatches a synthetic submit event AND calls requestSubmit(), so the
// handler runs twice and one click writes two files (@rjsf/core 5.23.2, Form.js:230-238). The
// toolbar button submits the form natively by id instead, which fires exactly once.
const META_FORM_ID = 'help-md-meta-form';

const PREVIEW_DEBOUNCE_MS = 200;

const useDebounced = (value, delay) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
};

const toForm = (meta, locale, slug) => ({
  route: meta.route ?? '',
  title: meta.title ?? '',
  order: meta.order === undefined || meta.order === '' ? undefined : Number(meta.order),
  locale,
  slug,
});

// Front matter is kept out of the Monaco buffer on purpose. The author edits prose; route, title,
// order, locale and slug live in the form above it. Nothing the form does rewrites the buffer, so a
// metadata edit can never move the cursor or break the undo stack. The two halves are recombined on
// save, which is what puts the front matter into the stored file where it travels with the document.
const MarkdownEditor = ({
  value,
  locale: initialLocale = '',
  slug: initialSlug = '',
  locales = [],
  routes = [],
  uploadImage,
  resolveImage,
  onSave,
  onCancel,
  onDelete,
  onMetaChange,
  onExport,
  saving = false,
}, context) => {
  const { intl } = context;
  const fmt = useCallback((id) => intl.formatMessage({ id, defaultMessage: id }), [intl]);

  const parsed = useMemo(() => parseFrontMatter(value), [value]);

  const [form, setForm] = useState(
    () => toForm(parsed.meta, initialLocale || locales[0]?.value || '', initialSlug)
  );
  const [body, setBody] = useState(parsed.body);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSlug));
  const [showPreview, setShowPreview] = useState(true);

  // Trails `body`, so parsing happens after a typing pause rather than inside the keystroke.
  const previewBody = useDebounced(body, PREVIEW_DEBOUNCE_MS);
  const stats = useMemo(() => formatStats(previewBody), [previewBody]);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  // Tracks the document we last loaded, so a new `value` from the parent re-seeds the form but our
  // own edits echoing back through it do not.
  const loadedRef = useRef(value);

  // Hiding the preview changes the grid template, which resizes the pane without a window resize.
  // automaticLayout can miss that, leaving the text column at its old half-width inside a pane that
  // is now full width. Measuring explicitly on the toggle keeps the content matched to the pane.
  useEffect(() => { editorRef.current?.layout(); }, [showPreview]);

  useEffect(() => {
    if (value === loadedRef.current) return;
    loadedRef.current = value;
    const next = parseFrontMatter(value);
    setForm(current => toForm(next.meta, current.locale, current.slug));
    setBody(next.body);
  }, [value]);

  // A translation normally reuses the source document's slug, and toSlug drops non-Latin scripts
  // entirely, so the suggestion only ever fills an untouched field.
  useEffect(() => {
    if (slugTouched) return;
    const suggestion = toSlug(form.title);
    if (suggestion) setForm(current => ({ ...current, slug: suggestion }));
  }, [form.title, slugTouched]);

  const handleFormChange = ({ formData }) => {
    if (formData.slug !== form.slug) setSlugTouched(true);
    setForm(formData);
    // The route decides which plugin row the document and its figures are stored under, and the
    // owner of that decision is outside this component.
    if (formData.route !== form.route) onMetaChange?.(formData);
  };

  const { previewRef, handlePreviewScroll, watchEditor, resetToTop } = useScrollSync(editorRef, previewBody);

  const figures = useEditorFigures({
    editorRef, previewBody, resolveImage, uploadImage, fmt, onPasteText: resetToTop,
  });

  const resolvePreviewImage = useCallback(
    (name) => figures.pending[name]?.url ?? resolveImage?.(name) ?? null,
    [figures.pending, resolveImage]
  );

  // Exports the buffer as it stands, resolver included: the parent stores figures but only this
  // component knows about the ones dropped in this session and not yet uploaded, so an exported
  // draft carries exactly what the preview shows.
  const exportNow = useCallback(
    // Named around the component's own `form`, which holds the metadata and is what the two lines
    // below read.
    (exportForm) => onExport?.(
      exportForm,
      serializeFrontMatter({ route: form.route, title: form.title, order: form.order }, body),
      resolvePreviewImage
    ),
    [onExport, form.route, form.title, form.order, body, resolvePreviewImage]
  );

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    watchEditor(editor);
  }, [watchEditor]);

  // RJSF validates on submit and only calls this when the metadata is valid, so the toolbar's Save
  // drives the form rather than carrying its own copy of the rules.
  const handleSubmit = async ({ formData }) => {
    // The overlay covers the screen while a save runs, but Enter in a metadata field submits the
    // form natively and goes around it, which would write the document a second time.
    if (figures.uploading || saving) return;

    const meta = { route: formData.route, title: formData.title, order: formData.order };
    const document = serializeFrontMatter(meta, body);

    // Only figures the document still points at are worth storing; the rest were inserted and
    // then removed, and are dropped with the object URLs that backed their preview.
    const stored = await figures.commitFigures({
      locale: formData.locale, slug: formData.slug, body,
    });
    if (!stored) return;

    loadedRef.current = document;
    onSave?.({ document, locale: formData.locale, slug: formData.slug, meta });
  };

  return (
    <div className='md-editor'>

      {/* A save is one wait with two halves: the figures the document still points at upload first,
          one at a time, and only then does the parent write the document and re-read the list. The
          toolbar says which half is running; this stops the buffer being edited underneath it. */}
      {(figures.uploading || saving) && <Loading />}

      <MarkdownMetaForm
        formId={META_FORM_ID}
        form={form}
        locales={locales}
        routes={routes}
        intlContext={context}
        fmt={fmt}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
      />

      <MarkdownToolbar
        fmt={fmt}
        formId={META_FORM_ID}
        onWrap={(before, after, placeholder) => wrapSelection(editorRef.current, before, after, placeholder)}
        onPrefix={(prefix) => prefixLines(editorRef.current, monacoRef.current, prefix)}
        onInsertImage={figures.openPicker}
        canInsertImage={Boolean(uploadImage)}
        pendingCount={figures.pendingNames.length}
        onExport={onExport && exportNow}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(v => !v)}
        stats={stats}
        onCancel={onCancel}
        onDelete={onDelete}
        saving={saving}
        uploading={figures.uploading}
      />

      {figures.uploadError && (
        <div className='md-problems'>
          <Icon name='IconAlertTriangle' size={16} stroke={1.7} />
          <span>{figures.uploadError}</span>
        </div>
      )}

      <div
        className={`md-panes${showPreview ? '' : ' md-panes--solo'}${figures.dragging ? ' md-panes--dropping' : ''}`}
        onPasteCapture={figures.handlePaste}
        onDropCapture={figures.handleDrop}
        onDragOver={figures.handleDragOver}
        onDragLeave={figures.handleDragLeave}
      >
        {/* Monaco resolves the right-click target before it focuses itself, so on an unfocused
            editor the first contextmenu can fall outside the CONTENT_TEXT/CONTENT_EMPTY/TEXTAREA
            targets it accepts and be dropped. Focusing on the right-button mousedown, which fires
            first, means the editor is already focused by the time it handles the menu. Scoped to
            button 2 so ordinary clicking and drag-selection are untouched. */}
        <div
          className='md-pane md-pane--source'
          onMouseDownCapture={(event) => { if (event.button === 2) editorRef.current?.focus(); }}
        >
          <Editor
            height='100%'
            language='markdown'
            theme='vs'
            value={body}
            onChange={(next) => setBody(next ?? '')}
            onMount={handleMount}
            options={EDITOR_OPTIONS}
            loading={<div className='md-loading'>{fmt('perun.main.loading')}</div>}
          />
          {figures.dragging && <div className='md-dropzone'>{fmt('perun.help_editor.drop_images')}</div>}
        </div>

        {showPreview && (
          <div className='md-pane md-pane--preview' ref={previewRef} onScroll={handlePreviewScroll}>
            <MarkdownPreview markdown={previewBody} resolveImage={resolvePreviewImage} />
          </div>
        )}
      </div>

      <input
        ref={figures.fileInputRef}
        type='file'
        accept='image/*'
        multiple
        className='md-file-input'
        onChange={figures.handleFilePick}
      />
    </div>
  );
};

MarkdownEditor.contextTypes = {
  intl: PropTypes.object.isRequired,
};

export default MarkdownEditor;
