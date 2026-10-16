import React, { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { loadMarkdown, markdownReady, renderMarkdown } from '../../elements/guides/renderMarkdown';

/**
 * Renders the document body the way the help panel will.
 *
 * Content is appended as sanitized nodes rather than through dangerouslySetInnerHTML, so the
 * document is parsed once by marked and never re-parsed from a serialized string.
 *
 * marked and DOMPurify are loaded on demand (loadMarkdown). The help panel holds them before it
 * mounts this, so its table of contents finds the headings in the first commit. The editor mounts
 * it straight away, so there the preview waits for them, and a load that failed is tried again on
 * the next change to the document.
 */
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
