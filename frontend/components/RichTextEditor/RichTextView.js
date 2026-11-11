import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import { useRichText, renderRichText } from './richText';

/** Shows a RichTextEditor value read-only, kept to what the editor itself would keep. */
const RichTextView = ({ value, resolveImage, className = '' }) => {
  const intl = useIntl();
  const { libs, failed } = useRichText();
  const hostRef = useRef(null);

  useEffect(() => {
    if (hostRef.current && libs) hostRef.current.replaceChildren(renderRichText(value, libs, resolveImage));
  }, [libs, value, resolveImage]);

  if (failed) {
    const id = 'perun.rich_text.load_failed';
    return <div className='rte-loading'>{intl.formatMessage({ id, defaultMessage: id })}</div>;
  }
  return <div ref={hostRef} className={`rte-content rte-view ${className}`.trim()} />;
};

RichTextView.propTypes = {
  value: PropTypes.string,
  resolveImage: PropTypes.func,
  className: PropTypes.string,
};

export default RichTextView;
