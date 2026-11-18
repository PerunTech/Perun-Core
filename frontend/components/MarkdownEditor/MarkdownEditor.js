import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import Editor from '@monaco-editor/react';
import { Icon, alertUserV2 } from '../../elements';
import Loading from '../Loading/Loading';
import RichTextEditor from '../RichTextEditor/RichTextEditor';
import { loadRichText, markdownToHtml } from '../RichTextEditor/richText';
import MarkdownMetaForm from './MarkdownMetaForm';
import MarkdownPreview from './MarkdownPreview';
import MarkdownToolbar from './MarkdownToolbar';
import { useScrollSync } from './useScrollSync';
import { useEditorFigures } from './useEditorFigures';
import { guideFormat } from '../../elements/guides/guideFormat';
import { DOC_KIND, HTML_KIND, kindExtension } from '../../elements/guides/helpNames';
import { figureName } from '../../elements/guides/figureRefs';
import { richTextLosses } from './richTextLosses';
import {
  EDITOR_OPTIONS, wrapSelection, prefixLines, toSlug, formatStats,
} from './utils';

// RJSF's Form.submit() runs the handler twice, so one click wrote two files; the toolbar submits the
// form natively by id instead.
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

// The editing mode last chosen in this browser.
const MODE_KEY = 'perun.helpEditor.mode';

const preferredMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === 'richText' ? 'richText' : 'markdown';
  } catch {
    return 'markdown';
  }
};

const keepMode = (mode) => {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Only a convenience: the next editor starts in Markdown.
  }
};

const toForm = (meta, locale, slug) => ({
  route: meta.route ?? '',
  title: meta.title ?? '',
  order: meta.order === undefined || meta.order === '' ? undefined : Number(meta.order),
  locale,
  slug,
});

// The metadata stays out of the editing buffer, so a metadata edit can't move the cursor or break undo.
// The two halves are recombined on save. A rich text guide (kind 'html') is edited in rich text only;
// a Markdown guide can be converted to one, which takes effect when it is saved.
const MarkdownEditor = ({
  value,
  kind: initialKind = DOC_KIND,
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
}) => {
  const intl = useIntl();
  const fmt = useCallback((id) => intl.formatMessage({ id, defaultMessage: id }), [intl]);

  const [kind, setKind] = useState(initialKind);
  const isHtml = kind === HTML_KIND;
  const format = guideFormat(kind);
  const kindRef = useRef(initialKind);
  kindRef.current = initialKind;

  const parsed = useMemo(() => guideFormat(initialKind).parse(value), [value, initialKind]);

  const [form, setForm] = useState(
    () => toForm(parsed.meta, initialLocale || locales[0]?.value || '', initialSlug)
  );
  const [body, setBody] = useState(parsed.body);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSlug));
  const [showPreview, setShowPreview] = useState(true);
  // 'checking' while a guide opened in rich text is checked for what rich text would drop.
  const [mode, setMode] = useState(() => {
    if (initialKind === HTML_KIND) return 'richText';
    return preferredMode() === 'richText' ? 'checking' : 'markdown';
  });
  const [switching, setSwitching] = useState(false);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  // Trails body, so the marked and DOMPurify pass waits for a pause in typing.
  const previewBody = useDebounced(body, PREVIEW_DEBOUNCE_MS);
  const stats = useMemo(() => formatStats(previewBody, { html: isHtml }), [previewBody, isHtml]);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  // Tracks the document we last loaded, so a new `value` from the parent re-seeds the form but our
  // own edits echoing back through it do not.
  const loadedRef = useRef(value);

  // Hiding the preview resizes the pane without a window resize, which automaticLayout can miss.
  useEffect(() => { editorRef.current?.layout(); }, [showPreview]);

  useEffect(() => {
    if (value === loadedRef.current) return;
    loadedRef.current = value;
    const next = guideFormat(kindRef.current).parse(value);
    setKind(kindRef.current);
    setForm(current => toForm(next.meta, current.locale, current.slug));
    setBody(next.body);
    if (kindRef.current === HTML_KIND) setMode('richText');
    else setMode(current => (current === 'richText' ? 'checking' : current));
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
    // The route decides the plugin row, which the parent owns.
    if (formData.route !== form.route) onMetaChange?.(formData);
  };

  const { previewRef, handlePreviewScroll, watchEditor, resetToTop } = useScrollSync(editorRef, previewBody);

  const figures = useEditorFigures({
    editorRef, previewBody, resolveImage, uploadImage, fmt, onPasteText: resetToTop, namesOf: format.figureNames,
  });

  const resolvePreviewImage = useCallback(
    (name) => figures.pending[name]?.url ?? resolveImage?.(name) ?? null,
    [figures.pending, resolveImage]
  );

  // The rich text editor keeps a src as the Markdown wrote it, percent escapes included.
  const resolveRichImage = useCallback((src) => resolvePreviewImage(figureName(src)), [resolvePreviewImage]);

  const confirmLosses = useCallback((losses) => new Promise((resolve) => {
    const kinds = intl.formatList(losses.map(kind => fmt(`perun.help_editor.rich_text_loss_${kind}`)), { type: 'conjunction' });
    alertUserV2({
      type: 'warning',
      title: fmt('perun.help_editor.rich_text_losses_title'),
      message: intl.formatMessage(
        { id: 'perun.help_editor.rich_text_losses', defaultMessage: 'perun.help_editor.rich_text_losses' },
        { kinds }
      ),
      showCancel: true,
      confirmButtonText: fmt('perun.help_editor.switch_anyway'),
      cancelButtonText: fmt('perun.help_editor.cancel'),
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  }), [intl, fmt]);

  // Resolves whether the guide is now in rich text. A guide holding what rich text cannot write
  // back stays in Markdown unless the author, asked, switches anyway.
  const enterRichText = useCallback(async (ask) => {
    let libs;
    try {
      libs = await loadRichText();
    } catch (err) {
      console.error(err);
      // Asked for, the rich text editor says it could not load; opened in it, the guide stays in Markdown.
      setMode(ask ? 'richText' : 'markdown');
      return ask;
    }
    const losses = richTextLosses(new libs.Marked().lexer(bodyRef.current, { gfm: true }));
    if (losses.length && !(ask && await confirmLosses(losses))) {
      setMode('markdown');
      return false;
    }
    editorRef.current = null;
    setMode('richText');
    return true;
  }, [confirmLosses]);

  useEffect(() => {
    if (mode === 'checking') enterRichText(false);
  }, [mode, enterRichText]);

  const confirmConvert = useCallback((losses) => new Promise((resolve) => {
    const kinds = intl.formatList(losses.map(loss => fmt(`perun.help_editor.rich_text_loss_${loss}`)), { type: 'conjunction' });
    const dropped = losses.length
      ? ` ${intl.formatMessage({ id: 'perun.help_editor.convert_losses', defaultMessage: 'perun.help_editor.convert_losses' }, { kinds })}`
      : '';
    alertUserV2({
      type: 'warning',
      title: fmt('perun.help_editor.convert_title'),
      message: `${fmt('perun.help_editor.convert_message')}${dropped}`,
      showCancel: true,
      confirmButtonText: fmt('perun.help_editor.convert_confirm'),
      cancelButtonText: fmt('perun.help_editor.cancel'),
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  }), [intl, fmt]);

  // Read as the rich text mode reads it; the Markdown file is replaced only when the guide is saved.
  const convertToRichText = async () => {
    setSwitching(true);
    try {
      const libs = await loadRichText();
      const losses = richTextLosses(new libs.Marked().lexer(bodyRef.current, { gfm: true }));
      if (!await confirmConvert(losses)) return;
      editorRef.current = null;
      setBody(markdownToHtml(libs, bodyRef.current));
      setKind(HTML_KIND);
      setMode('richText');
    } catch (err) {
      console.error(err);
      alertUserV2({ type: 'error', title: fmt('perun.rich_text.load_failed') });
    } finally {
      setSwitching(false);
    }
  };

  const switchMode = async () => {
    if (mode === 'richText') {
      setMode('markdown');
      keepMode('markdown');
      return;
    }
    setSwitching(true);
    if (await enterRichText(true)) keepMode('richText');
    setSwitching(false);
  };

  // The resolver goes along: only this component knows the figures dropped this session.
  const exportNow = useCallback(
    (exportForm) => onExport?.(
      exportForm,
      format.serialize({ route: form.route, title: form.title, order: form.order }, body),
      resolvePreviewImage,
      kind
    ),
    [onExport, format, kind, form.route, form.title, form.order, body, resolvePreviewImage]
  );

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    watchEditor(editor);
  }, [watchEditor]);

  // RJSF calls this only with valid metadata, so Save drives the form rather than repeating its rules.
  const handleSubmit = async ({ formData }) => {
    // The overlay covers the screen while a save runs, but Enter in a metadata field submits the
    // form natively and goes around it, which would write the document a second time.
    if (figures.uploading || saving) return;

    const meta = { route: formData.route, title: formData.title, order: formData.order };
    const document = format.serialize(meta, body);

    const stored = await figures.commitFigures({
      locale: formData.locale, slug: formData.slug, body,
    });
    if (!stored) return;

    loadedRef.current = document;
    onSave?.({ document, locale: formData.locale, slug: formData.slug, meta, kind });
  };

  return (
    <div className='md-editor'>

      {/* Keeps the buffer from being edited while the figures upload and the document is written. */}
      {(figures.uploading || saving) && <Loading />}

      <MarkdownMetaForm
        formId={META_FORM_ID}
        form={form}
        extension={kindExtension(kind)}
        locales={locales}
        routes={routes}
        intl={intl}
        fmt={fmt}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
      />

      <MarkdownToolbar
        fmt={fmt}
        formId={META_FORM_ID}
        onWrap={(before, after, placeholder) => wrapSelection(editorRef.current, before, after, placeholder)}
        onPrefix={(prefix) => prefixLines(editorRef.current, monacoRef.current, prefix)}
        richText={mode !== 'markdown'}
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

      {mode === 'markdown' ? (
        <div
          className={`md-panes${showPreview ? '' : ' md-panes--solo'}${figures.dragging ? ' md-panes--dropping' : ''}`}
          onPasteCapture={figures.handlePaste}
          onDropCapture={figures.handleDrop}
          onDragOver={figures.handleDragOver}
          onDragLeave={figures.handleDragLeave}
        >
          {/* Focused on right mousedown: an unfocused Monaco can drop the first contextmenu. */}
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
      ) : (
        <div className='md-panes md-panes--solo md-panes--rich'>
          <div className='md-pane md-pane--rich' style={{ display: 'flex', flexDirection: 'column' }}>
            {mode === 'richText' ? (
              <RichTextEditor
                key={kind}
                className='md-rich-editor'
                format={isHtml ? 'html' : 'markdown'}
                value={body}
                onChange={setBody}
                uploadImage={uploadImage ? figures.holdImage : undefined}
                resolveImage={resolveRichImage}
                minHeight={0}
              />
            ) : (
              <div className='md-loading'>{fmt('perun.main.loading')}</div>
            )}
          </div>
        </div>
      )}

      {!isHtml && (
        <div className='md-modebar' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type='button' className='md-modebar-switch' onClick={switchMode} disabled={switching || mode === 'checking'}>
              {fmt(mode === 'richText' ? 'perun.help_editor.switch_to_markdown' : 'perun.help_editor.switch_to_rich_text')}
            </button>
            <button type='button' className='md-modebar-switch md-modebar-convert' onClick={convertToRichText} disabled={switching || mode === 'checking'}>
              {fmt('perun.help_editor.convert_to_rich_text')}
            </button>
          </span>
          {mode === 'markdown' && (
            <span className='md-modebar-markdown' role='img' title={fmt('perun.help_editor.markdown_supported')} aria-label={fmt('perun.help_editor.markdown_supported')}>
              <Icon name='IconMarkdown' size={18} stroke={1.6} />
            </span>
          )}
        </div>
      )}

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

export default MarkdownEditor;
