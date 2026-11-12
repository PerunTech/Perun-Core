import React, { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { loadMarkdown, markdownReady, renderMarkdown } from '../../elements/guides/renderMarkdown';

// Appended as sanitized nodes, so marked's output is never re-parsed from a string. The editor mounts
// this before marked has loaded, so it waits, and a failed load is retried on the next change.
const MarkdownPreview = ({ markdown, resolveImage, className = '' }) => {
  const intl = useIntl();
  const hostRef = useRef(null);
  const [ready, setReady] = useState(markdownReady);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    loadMarkdown().then(
      () => { if (!cancelled) setReady(true); },
      (err) => {
        console.error(err);
        if (!cancelled) setFailed(true);
      }
    );
    return () => { cancelled = true; };
  }, [ready, markdown]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;
    host.textContent = '';
    host.appendChild(renderMarkdown(markdown, resolveImage));
  }, [ready, markdown, resolveImage]);

  if (!ready && failed) {
    const id = 'perun.help_editor.preview_failed';
    return <div className='md-loading'>{intl.formatMessage({ id, defaultMessage: id })}</div>;
  }
  return <div ref={hostRef} className={`md-preview ${className}`.trim()} />;
};

export default MarkdownPreview;
