import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import Icon from '../../elements/util/Icon';
import RichTextToolbar, { DEFAULT_TOOLBAR, MARKDOWN_TOOLBAR } from './RichTextToolbar';
import { useRichText, richTextExtensions, normalizeHref, resolvedImage } from './richText';
import { cleanPastedHtml } from './pastedHtml';
import { filesFrom, isImageFile } from '../../functions/files';

// StarterKit keeps an empty paragraph after a closing list, quote or image to type into; it is not stored.
const valueOf = (editor, format) => {
  if (editor.isEmpty) return '';
  if (format === 'markdown') return editor.getMarkdown().replace(/^\n+/, '').replace(/\s+$/, '');
  return editor.getHTML().replace(/(<p><\/p>)+$/, '');
};

const LinkBar = ({ initial, fmt, onApply, onRemove, onCancel }) => {
  const [href, setHref] = useState(initial);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKeyDown = (event) => {
    // Enter would submit a surrounding form, and Escape close a surrounding modal.
    if (event.key === 'Enter') {
      event.preventDefault();
      onApply(href);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className='rte-linkbar' style={{ display: 'flex', alignItems: 'center' }}>
      <input
        ref={inputRef}
        type='text'
        className='rte-input'
        value={href}
        placeholder='https://'
        aria-label={fmt('link_address')}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={handleKeyDown}
        style={{ flex: '1 1 auto', minWidth: 0 }}
      />
      <button type='button' className='rte-btn rte-btn--primary' onClick={() => onApply(href)}>
        {fmt('link_apply')}
      </button>
      {initial && (
        <button type='button' className='rte-btn' onClick={onRemove}>{fmt('link_remove')}</button>
      )}
      <button type='button' className='rte-btn rte-btn--ghost' onClick={onCancel}>{fmt('cancel')}</button>
    </div>
  );
};

// Controlled; the value is HTML, or Markdown with format='markdown', '' when empty. Images go in only
// through uploadImage(file), which resolves with the src to keep; resolveImage(src) gives the URL shown.
const RichTextEditor = ({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = '',
  readOnly = false,
  autoFocus = false,
  format = 'html',
  toolbar = format === 'markdown' ? MARKDOWN_TOOLBAR : DEFAULT_TOOLBAR,
  uploadImage,
  resolveImage,
  minHeight = 160,
  maxHeight,
  id,
  className = '',
}) => {
  const intl = useIntl();
  const fmt = useCallback((key) => {
    const labelId = `perun.rich_text.${key}`;
    return intl.formatMessage({ id: labelId, defaultMessage: labelId });
  }, [intl]);

  const { libs, failed } = useRichText();
  const hostRef = useRef(null);
  const fileInputRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const [, setRevision] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState(null);
  const [linkHref, setLinkHref] = useState(null);

  const current = value ?? '';
  // The editor's callbacks are bound once, when it is created, and read the props through this.
  const latest = useRef(null);
  latest.current = { onChange, onBlur, onFocus, placeholder, uploadImage, fmt };
  // The last value handed to onChange, so the parent's echo of it is not loaded back in.
  const emitted = useRef(current);
  const resolveRef = useRef(resolveImage);
  const redraws = useRef(new Set());
  // The RTF of the paste under way, read before ProseMirror parses its HTML.
  const pastedRtf = useRef(null);
  // Pasted images waiting for uploadImage, by the object URL they show under until then.
  const pastedFiles = useRef(new Map());
  const objectUrls = useRef(new Set());

  useEffect(() => {
    resolveRef.current = resolveImage;
    redraws.current.forEach(draw => draw());
  }, [resolveImage]);

  useEffect(() => () => objectUrls.current.forEach(url => URL.revokeObjectURL(url)), []);

  const insertImages = useCallback((instance, files) => {
    const { uploadImage: upload, fmt: label } = latest.current;
    const images = files.filter(isImageFile);
    setProblem(images.length < files.length ? label('not_image') : null);
    if (!upload || !images.length) return;

    setUploading(count => count + images.length);
    // One at a time, so the images land in the order they were given.
    images.reduce((previous, file) => previous.then(async () => {
      try {
        const src = await upload(file);
        if (src && !instance.isDestroyed) instance.chain().focus().setImage({ src, alt: file.name }).run();
      } catch (err) {
        console.error(err);
        setProblem(label('upload_failed'));
      } finally {
        setUploading(count => count - 1);
      }
    }), Promise.resolve());
  }, []);

  // Each pasted image's object URL replaced by the src uploadImage gives it, or the image removed.
  const storePastedImages = useCallback((instance) => {
    const { uploadImage: upload, fmt: label } = latest.current;
    const entries = [...pastedFiles.current];
    pastedFiles.current = new Map();
    if (!entries.length) return;

    const replace = (from, to) => {
      if (instance.isDestroyed) return;
      const { tr, doc } = instance.state;
      const found = [];
      doc.descendants((node, pos) => { if (node.type.name === 'image' && node.attrs.src === from) found.push([node, pos]); });
      found.reverse().forEach(([node, pos]) => {
        if (to) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
        else tr.delete(pos, pos + node.nodeSize);
      });
      if (tr.docChanged) instance.view.dispatch(tr);
    };

    setUploading(count => count + entries.length);
    entries.reduce((previous, [url, file]) => previous.then(async () => {
      try {
        replace(url, await upload(file));
      } catch (err) {
        console.error(err);
        setProblem(label('upload_failed'));
        replace(url, null);
      } finally {
        setUploading(count => count - 1);
      }
    }), Promise.resolve());
  }, []);

  useEffect(() => {
    if (!libs) return undefined;
    emitted.current = current;
    const instance = new libs.Editor({
      element: hostRef.current,
      extensions: richTextExtensions(libs, {
        placeholder: () => latest.current.placeholder,
        image: resolvedImage(libs, resolveRef, redraws.current),
        markdown: format === 'markdown',
      }),
      content: current,
      contentType: format === 'markdown' ? 'markdown' : 'html',
      editable: !readOnly,
      autofocus: autoFocus ? 'end' : false,
      editorProps: {
        attributes: { class: 'rte-content', style: 'flex: 1 0 auto' },
        handleDOMEvents: {
          paste: (_view, event) => {
            pastedRtf.current = event.clipboardData?.getData('text/rtf') || null;
            return false;
          },
        },
        transformPastedHTML: (html) => {
          const rtf = pastedRtf.current;
          pastedRtf.current = null;
          const keepImage = latest.current.uploadImage && ((file) => {
            const url = URL.createObjectURL(file);
            objectUrls.current.add(url);
            pastedFiles.current.set(url, file);
            return url;
          });
          const cleaned = cleanPastedHtml(html, { rtf, keepImage });
          if (cleaned.dropped) setProblem(latest.current.fmt('pasted_images'));
          // After ProseMirror has inserted the slice, so the images are in the document to be updated.
          if (pastedFiles.current.size) setTimeout(() => storePastedImages(instance));
          return cleaned.html;
        },
        handlePaste: (_view, event) => {
          const files = filesFrom(event.clipboardData);
          // Word puts a picture of the copied text on the clipboard beside its HTML: the text wins.
          if (!latest.current.uploadImage || !files.length || event.clipboardData.getData('text/html')) return false;
          insertImages(instance, files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          const files = moved ? [] : filesFrom(event.dataTransfer);
          if (!files.length) return false;
          // Taken even without an upload, since the browser would otherwise open the file in place of the page.
          if (latest.current.uploadImage) {
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (at) instance.commands.setTextSelection(at.pos);
            insertImages(instance, files);
          }
          return true;
        },
      },
      onUpdate: ({ editor: changed }) => {
        emitted.current = valueOf(changed, format);
        latest.current.onChange?.(emitted.current);
      },
      onFocus: ({ editor: focused }) => latest.current.onFocus?.(valueOf(focused, format)),
      onBlur: ({ editor: blurred }) => latest.current.onBlur?.(valueOf(blurred, format)),
      onTransaction: () => setRevision(count => count + 1),
    });
    setEditor(instance);
    return () => {
      instance.destroy();
      setEditor(null);
    };
    // One editor per load of the libraries and format; the effects below keep it in step with the props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libs, format]);

  useEffect(() => {
    if (!editor || current === emitted.current) return;
    emitted.current = current;
    editor.commands.setContent(current, { emitUpdate: false, contentType: format === 'markdown' ? 'markdown' : 'html' });
  }, [editor, current, format]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly, false);
    if (readOnly) setLinkHref(null);
  }, [editor, readOnly]);

  const applyLink = (input) => {
    const href = normalizeHref(input);
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!href) {
      chain.unsetLink().run();
    } else if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected to link, so the address is inserted as its own text, and typing goes on outside it.
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
        .unsetMark('link')
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkHref(null);
  };

  const closeLink = () => {
    setLinkHref(null);
    editor.commands.focus();
  };

  const editable = Boolean(editor) && !readOnly;

  return (
    <div
      id={id}
      className={`rte-editor${readOnly ? ' rte-editor--readonly' : ''} ${className}`.trim()}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {editable && toolbar.length > 0 && (
        <RichTextToolbar
          editor={editor}
          toolbar={toolbar}
          fmt={fmt}
          linkOpen={linkHref !== null}
          onLink={() => setLinkHref(linkHref === null ? editor.getAttributes('link').href ?? '' : null)}
          onImage={() => fileInputRef.current?.click()}
          canInsertImage={Boolean(uploadImage)}
          uploading={uploading > 0}
        />
      )}

      {editable && linkHref !== null && (
        <LinkBar
          initial={linkHref}
          fmt={fmt}
          onApply={applyLink}
          onRemove={() => applyLink('')}
          onCancel={closeLink}
        />
      )}

      {problem && (
        <div className='rte-problems' role='alert' style={{ display: 'flex', alignItems: 'center' }}>
          <Icon name='IconAlertTriangle' size={16} stroke={1.7} />
          <span style={{ flex: '1 1 auto' }}>{problem}</span>
          <button type='button' className='rte-tool' aria-label={fmt('dismiss')} onClick={() => setProblem(null)}>
            <Icon name='IconX' size={15} stroke={1.7} />
          </button>
        </div>
      )}

      {!libs && (
        <div className='rte-loading'>{fmt(failed ? 'load_failed' : 'loading')}</div>
      )}

      <div
        ref={hostRef}
        className='rte-body'
        style={{
          display: 'flex', flexDirection: 'column', minHeight, maxHeight, overflowY: maxHeight ? 'auto' : undefined,
        }}
      />

      {uploadImage && (
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={(event) => {
            if (editor) insertImages(editor, [...event.target.files]);
            event.target.value = '';
          }}
        />
      )}
    </div>
  );
};

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  autoFocus: PropTypes.bool,
  format: PropTypes.oneOf(['html', 'markdown']),
  // Tool names from RichTextToolbar's TOOLS, '|' between groups; [] for no toolbar.
  toolbar: PropTypes.arrayOf(PropTypes.string),
  uploadImage: PropTypes.func,
  resolveImage: PropTypes.func,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  id: PropTypes.string,
  className: PropTypes.string,
};

export default RichTextEditor;
