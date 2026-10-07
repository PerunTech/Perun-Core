import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../../elements/util/Icon';

const NO_ROUTES = [];

/**
 * The routes a typed fragment should offer.
 *
 * Substring rather than prefix, and over the name as well as the path, so typing part of a module's
 * name finds it however its route is spelled. Exported because this is the whole of the widget's
 * logic, and it is worth pinning without standing a DOM up around it.
 */
export const filterRoutes = (routes, text) => {
  const needle = String(text ?? '').trim().toLowerCase();
  if (!needle) return routes;
  return routes.filter(route =>
    route.value.toLowerCase().includes(needle)
    || String(route.label ?? '').toLowerCase().includes(needle));
};

/**
 * The route field: free text, with the routes this deployment knows about offered by name.
 *
 * Not a `<datalist>`, which is what this was. A datalist is drawn by the browser outside the page,
 * so no rule reaches it: it cannot take the editor's type, colours or spacing, and it renders
 * differently in every browser. This is the same idea built from ordinary markup, which is what
 * makes it styleable.
 *
 * Not a select either, because route matching is a prefix match and no single option can cover two
 * routes that are not nested. The route is handed to react-router's matchPath, which takes a
 * parameter pattern, so `/main/:section(inventory|stock)` answers on both. A string like
 * that is not a route the application registers, only one that matches two of them, so it can
 * never appear in the list and has to be typeable. The list suggests, it does not constrain.
 *
 * The suggestions arrive through `ui:options` rather than the schema, being a presentation
 * concern: what the field accepts is the schema's business, and it accepts any path.
 */
const RouteWidget = ({
  id, value, required, disabled, readonly, autofocus, onChange, onBlur, onFocus, options,
}) => {
  // Read as a plain member access rather than through `??` so the memo below has a stable
  // dependency; the fallback is a module constant for the same reason.
  const offered = options?.routes;
  const routes = offered ?? NO_ROUTES;
  const [open, setOpen] = useState(false);
  // Which option the keyboard is on, as an index into `matches`. -1 is "none", which is the state
  // the list opens in: the field already holds a value, and arrowing should start from the top
  // rather than from wherever the caller happened to be.
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);

  const text = value ?? '';

  const matches = useMemo(() => filterRoutes(offered ?? NO_ROUTES, text), [offered, text]);

  // A typed pattern matches nothing in the list, and an empty box hanging under the field reads as
  // a fault. Nothing to suggest means nothing is shown.
  const visible = open && matches.length > 0;

  useEffect(() => { setActive(-1); }, [text]);

  // Keeps the highlighted option in view when arrowing past the end of a scrolled list.
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
      // Only when an option is actually highlighted, so Enter still submits the form otherwise.
      event.preventDefault();
      pick(matches[active]);
      return;
    }
    if (event.key === 'Escape' && open) {
      // Stopped here so a surrounding dialog or drawer does not also close on the same keypress.
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
      {/* mousedown rather than click, and prevented, so the input keeps focus and the blur that
          would close the list never fires before the choice lands. */}
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
