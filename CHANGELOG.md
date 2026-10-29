# Changelog

All notable changes to this project will be documented in this file.

---

## [4.5.8] - 2026-10-29

### Upgrading from 4.5.7
- **React 18**: the app renders through `createRoot`, so state updates are batched everywhere, and React listens for events on its root: a handler that stops a click also stops it before the document's listeners. `createRoot` is exported beside `ReactDOM`, and on `window.core`, for the modules' own roots
- **Intl**: modules read intl with `useIntl` or `IntlContext` imported from perun-core. Legacy `contextTypes = { intl }` is no longer filled (`IntlLegacyBridge` is gone), and `labelsManager`, `getPluginLabel` and `updateIdScreen` take the intl object
- **react-intl 12**: a label with a `{placeholder}` formatted without values gives its default message
- **Redux**: redux 5 and react-redux 9, with the store built by Redux Toolkit 2. redux-persist 4, redux-updeep, react-intl-redux, redux-logger and the two promise middlewares are replaced by perun-core's own code or dropped; persisted slices keep their `reduxPersist:<slice>` keys and `persist/REHYDRATE`
- **Grid**: react-data-grid is replaced by perun-core's own grid body on TanStack Table and TanStack Virtual. `.react-grid-*` and `.rdg-*` rules no longer match anything and `grid.css` left perun-core: the grid, its toolbar and its cell editors take their look from the deployment's assets (aims-assets: `perun-grid.css` and the top of `datagrid.css`)
- **Select**: react-select 1 is replaced by a `Select` of perun-core's own, with the same markup, class names and props; its look comes from the deployment's `perun-select.css`
- **GenericGrid's slice** holds only what the grid publishes (`gridConfig`, `rows`, `filters`, `filteredRows`, the selection) beside what the reducer writes; `gridData` stays as fetched. `handleRowUpdatedFunct` is called with `(id, rows, fromRow, updated)`, and `handleGridRowsUpdated` is gone. A grid fetches again when `gridType`, `configTableName`, `dataTableName` or `params` change, so a search can give it new props, and `GridManager.reloadGridData` fetches with the current ones
- **Errors**: the response interceptor rejects 302, 401, 502 and 503 after its dialog, where it resolved `undefined`. `alertUserResponse` stays quiet for an error already shown, and `wasReported` is exported for catches that alert some other way
- **Removed exports**: `Draggable`, `DraggableCore`, `createFilterOptions`, `redux.findObjInJSONbyKey`, `redux.changeUndefinedObjectProperty`
- **Language**: the user's pick is kept in a `selectedLocale` cookie; until there is one, the `DEFAULT_LOCALE` system parameter decides, then the old `defaultLocale` cookie, then en_US
- **Page**: `www/index.html` no longer loads `geospatial.js`; the map's settings are `SPATIAL_*` system parameters
- **Versions**: tags are lightweight and carry no `v` (the old `v4.5.x` tags were renamed), so a module can depend on `#semver:^4.5.8`; `version` is exported from the bundle

### New Features
- **Workflow diagram**: an automaton's items drawn as a state diagram, with a report of missing statuses, repeated transitions and more than one default route out of a status
- **Printout widget**: GenericForm's `PrintoutButton` widget opens the field's print route in a new tab, also on a read-only form
- **Grid**: draws only the rows in view; cells edit with the keys react-data-grid had (arrows, Tab, Enter, Escape, typing); "No rows match these filters" with a Clear filters button; the row count reads "21 of 248" under a filter; a count of the ticked rows with a Clear button; `data-type`, `data-filtered` and `data-action` markers for the deployments' sheets; header names break after their underscores; tabler sort arrows
- **Select**: its menu is placed in the window, so a box that scrolls no longer cuts it off, and opens above the field when there is no room below; typing matches every word in any order, ignoring case and accents; past 100 options only those in view are drawn; ARIA combobox attributes and translated texts (`perun.main.select.*`)
- **Language**: a `DEFAULT_LOCALE` system parameter sets a deployment's default language
- **Exports**: the loading overlay shows while an export's module loads

### Bug Fixes
- The language picked on the login page survives a refresh
- A search form no longer runs a closed screen's search handler: the Users and Associate search forms get an id per mount, and the Users one the class `users-search-form`
- Running a search again no longer leaves its grid on the loader or showing the previous search's rows
- The grid's context menu acts on the row clicked on a sorted grid, where the edit action opened another record
- Code list filters pass over rows with no value instead of throwing; an export lists each value picked in a code list filter and a text filter's text
- Labels reloaded in the same locale reach the grid headers
- `PERUN_MENU`'s `MENU_CONF` stays a read-only field that opens the JSON editor, whatever order its schemas arrive in
- Clearing a single-select with Backspace no longer crashes GenericForm, and clearing Direct access' access key no longer throws
- The maintenance dialog opens once when several requests fail together, a lost connection says "Unable to connect" once, and no HTML error alert shows over the maintenance dialog at boot
- Navigating through the router's history follows at once; the `Router history`, `Missing parameter` and form root help label console warnings are gone
- Password forms report the first rule a password breaks, so an empty one reads as empty
- Guides: a quoted title reads back as it was written, and a guide in a zipped folder keeps its locale and slug
- UI schema lookups pass over null values

### Build & Tooling
- **Bundle size**: `perun-core.js` down from 1.84 MB to 1.56 MB (503 to 441 KB gzipped). marked with DOMPurify, and json2csv, are on-demand modules beside the bundle; react-data-grid, react-select 1, react-draggable and the old Redux add-ons are gone
- **Scrolling**: Bootstrap's `legend+*` rule is left out, since it made every step of a grid's scroll restyle every row, and grids draw 10 rows past each edge
- **Unit tests**: a Vitest suite (332 tests, `pnpm test`), run in the GitLab pipeline and in the GitHub release workflow before the build
- **Releases**: candidates are cut on dev (`4.5.8-rc.1`, `4.5.8-rc.2`); Maven Central publishes from a release's tag instead of from every push to main
- **pnpm 11**: the lockfile is written by pnpm 11.24.0, the overrides live in `pnpm-workspace.yaml`, and the tests need Node 22.22.2 or newer
- **Dev server**: `pnpm dev` takes the backend from `PERUN_BACKEND` (`.env.local`) and serves the committed `www/index.html`; `www/config.js` is no longer tracked
- **Backend**: `/perun` is served with `Cache-Control`: `no-cache`, or a year for an on-demand module whose `?v=` matches its contents
- Redux DevTools in debug builds in place of redux-logger
- Dependencies bumped within their ranges (dompurify, rjsf 5.24.13, react-bootstrap, pdfmake, marked, TanStack, Vite, oxlint); follow-redirects and fast-uri moved past their advisories, and `pnpm audit` is clean

---

## [4.5.7] - 2026-10-07

### New Features
- **User guides**: route-aware guides authored in the Admin Console; a guide can point at any route, not just a module root, and names the module its route belongs to; general manuals are grouped apart from the screen's own
- **Guide import and export**: import a guide from a `.md` file or a source archive; upload PDFs as manuals and read them in the guides panel, with a note on why a PDF manual cannot be edited and an offer to replace it; export guides as PDF or as a Markdown+figures archive, replacing print
- **Guide window**: carries the deployment's linked stylesheets; type and gutters sized to the window
- **Help**: reorganized into `fieldHelp` and `guides`; help buttons left out of the tab order; `AdminConsoleHelpButton` passes the locale to `fetchLabelText`
- **Exports**: a user group exports with its ACL records as JSON; the PerunMenu JSON export includes the table record and placeholders the SCHEMA value
- **System parameters**: JSON editor for `SVAROG_SYS_PARAMS.PARAM_VALUE`
- **Backend**: `Configurator` creates the `PERUN_CORE_EXEC.LOGIN_USER` and `PERUN_CORE_EXEC.LOGOFF_USER` ACLs during the ACL update

### Bug Fixes
- Plugin bundles load once, through one registry shared by the boot and `ModuleMenu`, instead of twice
- Grid filters work on code list values the server sends already translated; grid export decodes multi-value code list columns
- `GenericForm` keeps JSON schema defaults in the form data it publishes
- Dependency dropdowns render when their form section has no data yet
- Logging out no longer raises an alert: guide fetches are skipped without a session
- Guides: figures whose names are not plain ASCII show; editor figures resolve the way the reader does; a picked file is checked for what it actually is; the loader shows while a guide saves; deleting a guide in the editor deletes it
- Users grid: fixed the linked groups web service URL
- Config logs show the no-log message when a log has no note text
- `MyProfile` imports `ReactDOM` again

### Build & Tooling
- **Vite and pnpm**: the bundle is built by Vite in UMD library mode instead of webpack, and dependencies are installed with pnpm instead of npm; Node 22.12 or newer is required. `pnpm dev` serves the dev bundle under `/perun/`
- **oxlint** replaces eslint, and `pnpm lint` now fails the pipeline on an error
- **On-demand modules**: pdfmake, the tabler icon set and xlsx-js-style are built as ES modules beside `perun-core.js` and loaded only when used (the Excel library only when a grid is exported)
- **Bundle size**: `perun-core.js` down from 3.2 MB to 1.8 MB. Dropped react-data-grid-addons (replaced by grid pieces of our own), react-json-view, sweetalert (`alertUser` now runs on sweetalert2), react-ga (page views go to GA4) and redux-auth-wrapper (replaced by a local route guard); validator is imported per check; five unused files and `memorizeFrMapRoute` removed
- Upgraded react-intl to 6.8.9 and pdfmake to 0.3.x, dropping deprecated transitive dependencies; declared the markdown dependencies and scoped the dompurify override
- CI: the generate-js jobs commit only the bundle; the GitHub release cleans the build output before building
- Multiple `npm audit` fixes

---

## [4.5.6] - 2026-08-18

### New Features
- **Admin Console help system**: page/form/field-level help with lazy-fetched labels, filtered by active locale; `HelpFieldTemplate` for per-field help in `GenericForm`; rendered above dependency dropdowns; added to LabelEditor, CodeListEditor, User Management, and ConfigTables forms; suppressed on read-only conf-log preview forms
- **Dependent dropdowns**: array-schema support in `DependentElements` with isolated dropdown chains per array row and `allOf`-conditional field cleanup; `DependentValueField` gained dedicated-endpoint lookups and was wired into `GenericForm`
- **Exports**: multi-table and table-records export added to ConfigTables, with batched WsCore requests for performance; JSON export option added to the Perun Menu download modal
- **GenericGrid**: print feature driven by menu config
- **JsonEditor**: segmented theme toggle; improved save/reset reliability
- **Tables & Fields**: "associate user with table" preview; loading indicator

### Bug Fixes
- Fixed crash in `allOf` conditional field title lookup and dependency-dropdown chain isolation in flat schemas
- Fixed array-row cleanup scoping and form-data sync via `ComponentManager` in `onChange`
- Blob download helpers now guard against null/undefined input
- Fixed `ModuleMenu` image URLs wrongly including `/services` when `window.server` is a relative path; asset URLs now use the configured server origin instead of `window.location.origin`
- Fixed PasswordForm modal rendering; matched `DependentValueField` checkbox markup to rjsf's default `CheckboxWidget`

### Build & Tooling
- Updated `react-router-dom` to 5.3.4 to remove the deprecated `mini-create-react-context` dependency
- Moved `getServerOrigin` from `elements/util` into the general `functions/utils` module; exported from `elements`
- Multiple `npm audit` fixes
- Maven build now runs from the repo root

---

## [4.5.5] - 2026-06-23

### New Features
- **JSON editor**: Replaced the legacy JSON editor/viewer with Monaco editor; extracted JsonEditor utilities; fixed `handleFormat` to populate `editorRef` on mount
- **reCAPTCHA**: Load script conditionally based on the `GOOGLE_CAPTCHA_ENABLED` system parameter
- **Google Analytics**: Load script conditionally based on the `GOOGLE_ANALYTICS_ID` system parameter
- **Tasks**: New tasks component with supporting logic and web services
- **LabelEditor**: Refactored into focused sub-components; enabled in the UI
- **Server unavailability**: Graceful handling on page load with SweetAlert2 fallback; applied to `index.html` template
- **Login CSS**: New login-specific classes replacing generic logon CSS classes

### CodeList Editor
- Fully refactored the CodeList editor
- Auto-search new codelist after save
- Children sorted by `SORT_ORDER` in both the grid and exported tree
- Pre-fill and disable `PARENT_CODE_VALUE` when adding child codes; disable when editing existing codelist entries
- Breadcrumb updated on edit
- Export always includes the full tree from root, regardless of current navigation depth

### Svarog Tables & Fields Admin
- Added `ConfigTables` component for config-type tables; `SvarogTables` now filtered to non-config tables only
- Inline field editor with `GUI_METADATA` badge and editing
- New-table creation flow and fixed table edit form submission
- Switched fields fetch to `WsCore/children`
- Field label displayed in the editor; field export no longer drops server-only values

### Export UX
- Auto-select locale when only one is configured
- Trigger export on locale select
- Export loading state; fixed preview race condition on cancel
- Close modal after export; improved empty-fields hint text

### UI / UX
- `SystemConfLogs`: improved grid config and log preview
- `CACHE_TYPE`: show translated value
- Labels: always show the label (not only when translated); show index as title

### Bug Fixes
- Axios: suppress alert on cancelled requests; handle connection refused errors
- Abort in-flight form fetches; deduplicate `getRowField`; guard export on empty breadcrumb
- `onInputChange`: fix spreading array `formData` into an object (losing array type)
- `isJSON`: drop `strcmp` dependency, check objects directly, handle null
- CodeList: fix stale search grid after root node delete
- Alert when `BUSINESS_OBJECT_TYPE_NAME` parameter is missing
- Export locale auto-select: use `useEffect` for locales arriving after modal opens; validate parsed array before use

### Build & Tooling
- CI: updated Node.js version; switched to `npm ci` with `.npm` cache; webpack filesystem cache with absolute cache path
- Overrode `dompurify` to 3.4.0
- Multiple `npm audit` fixes

### Docs
- Clarified Google Analytics and reCAPTCHA configuration docs

---

## [4.5.4] - 2026-04-17

### Build & Tooling
- Parallelized Babel transpilation; narrowed `preset-env` targets for smaller bundles
- Modernized and cleaned up Webpack config; added filesystem cache
- Updated `engines` property in `package.json`
- Upgraded `maven-bundle-plugin` to 5.1.9
- Multiple `npm audit` fixes across several commits

### ESLint
- Migrated from ESLint v8 to v9

### Dependencies
- Replaced `xlsx` with `xlsx-js-style`

### Features
- **Session token**: sent as `sessionId` header on every request
- **Reload all grids**: new logic to reload all grids at once
- **Selected rows**: improved tracking when sorting/filtering is applied; reset filters and filtered rows
- **Tables & Fields**: components for managing DB tables and fields, download as JSON, handle add/delete
- **Workflow**: added workflow item params to perun-core
- **Icons**: new icon handling approach; fixed broken imports
- **User management**: new user management web services
- **Router**: fixes for the reload issues

### UI / UX
- New and updated labels across multiple commits

### Docs & Config
- Rewrote README with reorganized dev guide; added prerequisites and index.html template
- Standardized `client.js` comments; extracted GA tracking ID to env variable
- Various clean-ups and minor clarifications

---

## [4.5.3] - 2026-01-22

### General Updates
- Added an admin console component for managing the `PERUN_MENU` table
- Added an admin console component for managing the `SVAROG_WORKFLOW_AUTOMATON` table
- Added the `@tabler/icons-react` package and a component for displaying the icons

### Improvements
- Added more utility functions to avoid duplicating code across projects/modules

### Clean-up
- Removed unused/deprecated `Module Menu` and `Context Menu` components

---

## [4.5.2] - 2025-09-19

### General Updates
- Added generic functions to avoid code duplication
- Added language switch functionality to `PerunNavbar`

### Improvements
- Formatting
- Card classes
- Error handling

---

## [4.5.1] - 2025-07-01

### Misc
- Removed naits check in `Router.js`

---

## [4.5.0] - 2025-06-30

### General Updates
- Updated outdated dependencies in `package.json` to improve stability and compatibility

### New Features
- **My Profile**: Added a new user profile section for easier account management
- **AlertUserV2**: Introduced an enhanced alert system for improved user notifications

### Improvements
- **User Management**: Reworked to enhance performance and usability
- **PerunNavbar**: Redesigned for improved performance, usability, and a more modern look

### Clean-up
- Removed unused components and deprecated functions to optimize the codebase
