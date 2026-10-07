# Changelog

All notable changes to this project will be documented in this file.

---

## [v4.5.7] - 2026-10-07

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

## [v4.5.6] - 2026-08-18

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

## [v4.5.5] - 2026-06-23

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

## [v4.5.4] - 2026-04-17

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

## [v4.5.3] - 2026-01-22

### General Updates
- Added an admin console component for managing the `PERUN_MENU` table
- Added an admin console component for managing the `SVAROG_WORKFLOW_AUTOMATON` table
- Added the `@tabler/icons-react` package and a component for displaying the icons

### Improvements
- Added more utility functions to avoid duplicating code across projects/modules

### Clean-up
- Removed unused/deprecated `Module Menu` and `Context Menu` components

---

## [v4.5.2] - 2025-09-19

### General Updates
- Added generic functions to avoid code duplication
- Added language switch functionality to `PerunNavbar`

### Improvements
- Formatting
- Card classes
- Error handling

---

## [v4.5.1] - 2025-07-01

### Misc
- Removed naits check in `Router.js`

---

## [v4.5.0] - 2025-06-30

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
