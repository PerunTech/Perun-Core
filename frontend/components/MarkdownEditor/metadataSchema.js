import RouteWidget from './RouteWidget';

// route, title and order go into the front matter; locale and slug form the filename.
export default function getMetadataSchema(intl, { locales = [], routes = [] } = {}) {
  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id });

  // An empty oneOf is an invalid schema, so an empty list falls back to a plain string.
  const locale = locales.length
    ? { type: 'string', title: fmt('perun.help_editor.locale'), oneOf: locales.map(item => ({ const: item.value, title: item.label })) }
    : { type: 'string', title: fmt('perun.help_editor.locale') };

  // Free text (see RouteWidget), so only the leading slash is validated and a route matching nothing
  // simply never shows. The suggestions go through the uiSchema so each can carry its title.
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

// In place of ajv's wording, so an author sees why a field is wrong.
export const transformMetadataErrors = (errors, intl) => {
  const fmt = (id) => intl.formatMessage({ id, defaultMessage: id });

  return errors.map(error => {
    const field = error.property?.replace(/^\./, '');
    if (field === 'route') return { ...error, message: fmt('perun.help_editor.error_route') };
    if (field === 'slug') return { ...error, message: fmt('perun.help_editor.error_slug') };
    if (field === 'locale') return { ...error, message: fmt('perun.help_editor.error_locale') };
    if (field === 'order') return { ...error, message: fmt('perun.help_editor.error_order') };
    return error;
  });
};
