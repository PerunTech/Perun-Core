import RouteWidget from './RouteWidget';

/**
 * Schema for the guide metadata form.
 *
 * `route`, `title` and `order` are written into the document's front matter on save; `locale` and
 * `slug` form the filename. They share one form because an author does not care which half of the
 * stored file a field ends up in.
 */
export default function getMetadataSchema(context, { locales = [], routes = [] } = {}) {
  const fmt = (id) => context.intl.formatMessage({ id, defaultMessage: id });

  // oneOf renders a select. An empty oneOf is an invalid schema, so each falls back to a plain
  // string field when its option list is empty.
  const locale = locales.length
    ? { type: 'string', title: fmt('perun.help_editor.locale'), oneOf: locales.map(item => ({ const: item.value, title: item.label })) }
    : { type: 'string', title: fmt('perun.help_editor.locale') };

  // A text field offering the known routes as a datalist, rather than a select limited to them.
  // The list carries the registered modules, the general /main entry, and every route already used
  // by a saved guide, so the common answers are one keystroke away and an older document does not
  // find its own route missing.
  //
  // Free text rather than a closed list, because a select can only offer routes it can enumerate,
  // and route matching is a prefix match: /main/inventory does not cover a sibling such as
  // /main/stock, so no single option covers both. The route is handed to react-router's
  // matchPath, which accepts a parameter pattern, so `/main/:section(inventory|stock)`
  // answers on both and on nothing else. That string is not a route the application registers,
  // only one that matches two of them, so it can never appear as an option.
  //
  // The trade is real: a typo now reaches the store, where the select made that unreachable. Only
  // the leading slash is validated, and a guide whose route matches nothing simply never appears.
  // The suggestions themselves are handed to RouteWidget through the uiSchema, so the list can
  // carry each route's title; `examples` here would render as bare paths.
  const route = {
    type: 'string',
    title: fmt('perun.help_editor.route'),
    pattern: '^/',
    ...(routes.length ? { default: routes[0].value } : {}),
  };

  return {
    schema: {
      type: 'object',
      required: ['route', 'locale', 'slug'],
      properties: {
        route,
        title: { type: 'string', title: fmt('perun.help_editor.title') },
        locale,
        slug: {
          type: 'string',
          title: fmt('perun.help_editor.slug'),
          pattern: '^[a-z0-9][a-z0-9-_]*$',
        },
        order: { type: 'integer', title: fmt('perun.help_editor.order') },
      },
    },
    uiSchema: {
      'ui:order': ['route', 'title', 'locale', 'slug', 'order'],
      route: { 'ui:classNames': 'md-f md-f--grow', 'ui:widget': RouteWidget, 'ui:options': { routes, toggleLabel: fmt('perun.help_editor.show_routes') } },
      title: { 'ui:classNames': 'md-f md-f--grow' },
      locale: { 'ui:classNames': 'md-f md-f--narrow' },
      slug: { 'ui:classNames': 'md-f' },
      order: { 'ui:classNames': 'md-f md-f--narrow' },
    },
  };
}

/**
 * ajv reports pattern and required failures in its own wording. These are the same messages the
 * hand-rolled checks used, so an author sees why a field is wrong rather than the raw rule.
 */
export const transformMetadataErrors = (errors, context) => {
  const fmt = (id) => context.intl.formatMessage({ id, defaultMessage: id });

  return errors.map(error => {
    const field = error.property?.replace(/^\./, '');
    if (field === 'route') return { ...error, message: fmt('perun.help_editor.error_route') };
    if (field === 'slug') return { ...error, message: fmt('perun.help_editor.error_slug') };
    if (field === 'locale') return { ...error, message: fmt('perun.help_editor.error_locale') };
    if (field === 'order') return { ...error, message: fmt('perun.help_editor.error_order') };
    return error;
  });
};
