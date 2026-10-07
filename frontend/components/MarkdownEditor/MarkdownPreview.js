import React, { useEffect, useRef } from 'react';
import { renderMarkdown } from '../../elements/guides/renderMarkdown';

/**
 * Renders the document body the way the help panel will.
 *
 * Content is appended as sanitized nodes rather than through dangerouslySetInnerHTML, so the
 * document is parsed once by marked and never re-parsed from a serialized string.
 */
const MarkdownPreview = ({ markdown, resolveImage, className = '' }) => {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.textContent = '';
    host.appendChild(renderMarkdown(markdown, resolveImage));
  }, [markdown, resolveImage]);

  return <div ref={hostRef} className={`md-preview ${className}`.trim()} />;
};

export default MarkdownPreview;
