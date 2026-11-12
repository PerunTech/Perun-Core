import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Must equal the CSS line-height of .label-export-preview pre, or the scroll math drifts.
const LINE_HEIGHT = 20; // px
const OVERSCAN = 30; // lines past each edge, so a fast scroll doesn't flash blank

const renderLine = (line, key) => {
    if (line.startsWith('#')) {
        return <span key={key} className='lep-comment'>{line}{'\n'}</span>;
    }
    const eq = line.indexOf('=');
    if (eq !== -1) {
        return (
            <span key={key}>
                <span className='lep-key'>{line.slice(0, eq)}</span>
                <span className='lep-eq'>{'='}</span>
                <span className='lep-value'>{line.slice(eq + 1)}</span>
                {'\n'}
            </span>
        );
    }
    return <span key={key}>{line}{'\n'}</span>;
};

const PropertiesPreview = ({ text }) => {
    const containerRef = useRef(null);
    const lines = useMemo(() => text.split('\n'), [text]);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(400);

    useEffect(() => {
        if (containerRef.current) setContainerHeight(containerRef.current.clientHeight);
    }, []);

    const handleScroll = useCallback((e) => setScrollTop(e.currentTarget.scrollTop), []);

    const start = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
    const end = Math.min(lines.length, Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + OVERSCAN);

    // Padded to the full height, so the scrollbar matches while only the visible slice is drawn.
    return (
        <div ref={containerRef} className='label-export-preview' onScroll={handleScroll}>
            <pre style={{ margin: 0, paddingTop: start * LINE_HEIGHT, paddingBottom: (lines.length - end) * LINE_HEIGHT }}>
                {lines.slice(start, end).map((line, i) => renderLine(line, start + i))}
            </pre>
        </div>
    );
};

export default PropertiesPreview;
