import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../../elements/util/Icon';

const NO_ROUTES = [];

// Substring, over the name as well as the path, so part of a module's name finds it.
export const filterRoutes = (routes, text) => {
  const needle = String(text ?? '').trim().toLowerCase();
  if (!needle) return routes;
  return routes.filter(route =>
    route.value.toLowerCase().includes(needle)
    || String(route.label ?? '').toLowerCase().includes(needle));
};

// Free text with suggestions: a pattern such as /main/:section(inventory|stock) matches two routes and
// is in no list. Built from markup, not a <datalist>, which no style rule reaches.
const RouteWidget = ({
  id, value, required, disabled, readonly, autofocus, onChange, onBlur, onFocus, options,
}) => {
  // A plain member access, and a module constant fallback, so the memo's dependency is stable.
  const offered = options?.routes;
  const routes = offered ?? NO_ROUTES;
  const [open, setOpen] = useState(false);
  // -1 is none, which the list opens in, so arrowing starts from the top.
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);

  const text = value ?? '';

  const matches = useMemo(() => filterRoutes(offered ?? NO_ROUTES, text), [offered, text]);

  // A typed pattern matches nothing, and an empty box under the field reads as a fault.
  const visible = open && matches.length > 0;

  useEffect(() => { setActive(-1); }, [text]);

  useEffect(() => {
    if (!visible || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [visible, active]);

  const pick = useCallback((route) => {
    onChange(route.value);
    setOpen(false);
    setActive(-1);
  }, [onChange]);

  const onKeyDown = useCallback((event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(current => {
        const next = current + step;
        if (next < 0) return matches.length - 1;
        return next >= matches.length ? 0 : next;
      });
      return;
    }
    if (event.key === 'Enter' && visible && active >= 0) {
      // Only with an option highlighted, so Enter still submits the form otherwise.
      event.preventDefault();
      pick(matches[active]);
      return;
    }
    if (event.key === 'Escape' && open) {
      // So a surrounding dialog or drawer doesn't close too.
      event.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  }, [open, visible, active, matches, pick]);

  const input = (
    <input
      id={id}
      name={id}
      type='text'
      className='form-control'
      value={text}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      autoComplete='off'
      role={routes.length ? 'combobox' : undefined}
      aria-expanded={routes.length ? visible : undefined}
      aria-controls={routes.length ? `${id}__list` : undefined}
      aria-autocomplete={routes.length ? 'list' : undefined}
      aria-activedescendant={visible && active >= 0 ? `${id}__option_${active}` : undefined}
      onChange={event => {
        onChange(event.target.value === '' ? options?.emptyValue : event.target.value);
        setOpen(true);
      }}
      onKeyDown={onKeyDown}
      onFocus={event => { setOpen(true); onFocus?.(id, event.target.value); }}
      onBlur={event => { setOpen(false); setActive(-1); onBlur?.(id, event.target.value); }}
    />
  );

  if (!routes.length) return input;

  return (
    <div className='md-combo'>
      {input}
      {/* mousedown, prevented, so the input keeps the focus and its blur doesn't close the list first. */}
      <button
        type='button'
        className='md-combo-toggle'
        tabIndex={-1}
        disabled={disabled || readonly}
        aria-label={options?.toggleLabel ?? 'Show routes'}
        onMouseDown={event => { event.preventDefault(); setOpen(current => !current); }}
      >
        <Icon name='IconChevronDown' size={15} stroke={1.8} />
      </button>
      {visible && (
        <ul className='md-combo-list' id={`${id}__list`} role='listbox' ref={listRef}>
          {matches.map((route, index) => (
            <li
              key={route.value}
              id={`${id}__option_${index}`}
              role='option'
              aria-selected={route.value === text}
              className={`md-combo-option${index === active ? ' is-active' : ''}${route.value === text ? ' is-chosen' : ''}`}
              onMouseDown={event => { event.preventDefault(); pick(route); }}
              onMouseEnter={() => setActive(index)}
            >
              {route.label && <span className='md-combo-label'>{route.label}</span>}
              <code className='md-combo-path'>{route.value}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

RouteWidget.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  readonly: PropTypes.bool,
  autofocus: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  options: PropTypes.object,
};

export default RouteWidget;
