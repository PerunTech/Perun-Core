import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Editor, DiffEditor } from '@monaco-editor/react';
import { Icon, alertUserV2, ReactBootstrap } from '../../elements';
import { THEMES, BASE_OPTIONS, DIFF_OPTIONS, EDITOR_HEIGHT, getStats } from './utils';

const { Spinner } = ReactBootstrap;

const STATS_DEBOUNCE_MS = 200;

const JsonEditor = ({ value, originalValue, onSave, onDownload }) => {
  const intl = useIntl();
  const [showDiff, setShowDiff] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);

  const originalRaw = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const diffOriginalRaw = useMemo(
    () => originalValue != null ? JSON.stringify(originalValue, null, 2) : originalRaw,
    [originalValue, originalRaw]
  );

  // Real state (not a ref) so the Editor stays controlled: Monaco only re-applies `value` when it
  // actually differs from its own content, so this doesn't disturb cursor/undo while typing, but it
  // does mean the editor picks up `value`/`originalValue` changes from the parent after mount.
  const [currentRaw, setCurrentRaw] = useState(originalRaw);
  const [stats, setStats] = useState(() => getStats(originalRaw));
  const editorRef = useRef(null);
  const statsTimeoutRef = useRef(null);

  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id });

  // Re-baseline whenever the parent supplies genuinely new content (not our own onChange echo)
  const prevOriginalRawRef = useRef(originalRaw);
  useEffect(() => {
    if (originalRaw !== prevOriginalRawRef.current) {
      prevOriginalRawRef.current = originalRaw;
      setCurrentRaw(originalRaw);
      setStats(getStats(originalRaw));
    }
  }, [originalRaw]);

  useEffect(() => () => {
    if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current);
  }, []);

  const theme = THEMES[themeIndex].value;

  const handleChange = useCallback((raw) => {
    const next = raw ?? '';
    setCurrentRaw(next);
    // Content updates immediately (needed to keep the editor controlled); the cheaper-but-still-
    // recomputed-on-every-keystroke stats readout is debounced separately.
    if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current);
    statsTimeoutRef.current = setTimeout(() => setStats(getStats(next)), STATS_DEBOUNCE_MS);
  }, []);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleFormat = useCallback(() => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const handleCopy = useCallback(() => {
    const text = currentRaw;
    // clipboard API requires a secure context (HTTPS); fall back to execCommand for HTTP
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [currentRaw]);

  const handleReset = useCallback(() => {
    alertUserV2({
      type: 'question',
      title: fmt('perun.admin_console.json_reset_confirm'),
      confirmButtonText: fmt('perun.admin_console.yes'),
      confirmButtonColor: '#87adbd',
      onConfirm: () => {
        setCurrentRaw(originalRaw);
        setStats(getStats(originalRaw));
      },
      showCancel: true,
      cancelButtonText: fmt('perun.admin_console.no'),
    });
  }, [originalRaw]);

  const handleAction = useCallback((fn) => {
    let parsed;
    try {
      parsed = JSON.parse(currentRaw);
    } catch {
      alertUserV2({
        type: 'error',
        title: fmt('perun.admin_console.json_invalid'),
      });
      return;
    }
    fn(parsed);
  }, [currentRaw]);

  const editorLoading = (
    <div className='json-editor-loading'>
      <Spinner animation='border' size='sm' />
      <span>{fmt('perun.main.loading')}</span>
    </div>
  );

  return (
    <div className='json-editor-container'>
      <div className='json-editor-toolbar'>
        <div className='json-editor-theme-group' role='group'>
          {THEMES.map((t, i) => (
            <button
              key={t.value}
              type='button'
              onClick={() => setThemeIndex(i)}
              aria-pressed={i === themeIndex}
              className={`json-editor-btn btn-success btn_save_form json-editor-theme-btn${i === themeIndex ? ' json-editor-theme-btn--active' : ''}`}
            >
              {t.label}
              <span className='json-editor-icon'><Icon name={t.icon} /></span>
            </button>
          ))}
        </div>
        <button type='button' onClick={() => setShowDiff(s => !s)} className='json-editor-btn btn-success btn_save_form json-editor-diff-btn'>
          {fmt(showDiff ? 'perun.admin_console.back_to_editor' : 'perun.admin_console.show_diff')}
          <span className='json-editor-icon'><Icon name={showDiff ? 'IconCode' : 'IconGitCompare'} /></span>
        </button>
        <button type='button' onClick={handleFormat} disabled={showDiff} className='json-editor-btn btn-success btn_save_form'>
          {fmt('perun.admin_console.format')}
          <span className='json-editor-icon'><Icon name='IconWand' /></span>
        </button>
        <button type='button' onClick={handleCopy} className='json-editor-btn btn-success btn_save_form'>
          {fmt('perun.admin_console.copy')}
          <span className='json-editor-icon'><Icon name='IconCopy' /></span>
        </button>
        <button type='button' onClick={handleReset} className='json-editor-btn btn-success btn_save_form'>
          {fmt('perun.admin_console.reset')}
          <span className='json-editor-icon'><Icon name='IconRefresh' /></span>
        </button>
        {onSave && (
          <button type='button' onClick={() => handleAction(onSave)} className='json-editor-btn btn-success btn_save_form'>
            {fmt('perun.admin_console.config_menu_confirm')}
            <span className='json-editor-icon'><Icon name='IconCheck' /></span>
          </button>
        )}
        {onDownload && (
          <button type='button' onClick={() => handleAction(onDownload)} className='json-editor-btn btn-success btn_save_form'>
            {fmt('perun.admin_console.export_table_and_fields')}
            <span className='json-editor-icon'><Icon name='IconDatabaseExport' /></span>
          </button>
        )}
        <span className='json-editor-stats'>{stats}</span>
      </div>
      {/* Hidden instead of unmounted to preserve the editor's undo history when toggling diff view */}
      <div style={{ display: showDiff ? 'none' : 'block' }}>
        <Editor
          height={EDITOR_HEIGHT}
          language='json'
          theme={theme}
          value={currentRaw}
          onMount={handleEditorMount}
          onChange={handleChange}
          loading={editorLoading}
          options={BASE_OPTIONS}
        />
      </div>
      {showDiff && (
        <DiffEditor
          height={EDITOR_HEIGHT}
          language='json'
          theme={theme}
          original={diffOriginalRaw}
          modified={currentRaw}
          loading={editorLoading}
          options={DIFF_OPTIONS}
        />
      )}
    </div>
  );
};

export default JsonEditor;
