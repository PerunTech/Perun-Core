/**
 * The tabler icon set, by component name (`IconEye`, `IconBook`, ...).
 *
 * Not part of perun-core.js: built as a module of its own beside it by
 * build/modules.mjs, and loaded by `Icon` the first time one is drawn. Each
 * export is the arguments its icon's component is made from rather than the
 * component, so that this module carries no React; `Icon` makes the component.
 *
 * The package's whole entry, as webpack's chunk had it, rather than only its
 * icons/ index: the entry also names fifty-odd icons by the names they had
 * before tabler renamed them (`IconBoxSeam` for `IconPackage`), and an `Icon`
 * asked for by an old name should still draw.
 */
export * from '@tabler/icons-react';
