# Perun Core

The front-end module of the Svarog framework, containing the core functionalities such as login, admin console, plugin management and providing the React framework to other modules.

## Prerequisites

- [Node.js](https://nodejs.org/) (v22.12.0 or higher, which Vite and oxlint require)
- [pnpm](https://pnpm.io/) (v9 or higher)

## Getting Started

### Installation

```bash
pnpm install
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Production build under `/www` (minified, no source maps, no debug) |
| `pnpm build-dev` | The same production build with source maps and debug enabled; CI builds the `dev` branch this way |
| `pnpm dev` | Serves `www/index.html` on port 8080 with the bundle rebuilt on every save (unminified, source maps, debug) and the page reloaded after each rebuild. The bundle is served under `/perun/`, as a deployment serves it, so its sources show under `/perun/frontend/` in DevTools. Everything else is proxied to the backend that `PERUN_BACKEND` names (see [Running Perun Core Locally](#running-perun-core-locally)) |
| `pnpm lint` | Lints `frontend/` with oxlint; fails on an error |
| `pnpm lint:fix` | The same, fixing what oxlint can |

## Environment Variables

This project has no required build-time environment variables. Google Analytics is configured at runtime via the `GOOGLE_ANALYTICS_ID` system parameter fetched from the server (`WsConf/params/get/sys/GOOGLE_ANALYTICS_ID`). reCAPTCHA is loaded conditionally based on the `GOOGLE_CAPTCHA_ENABLED` system parameter (`WsConf/params/get/sys/GOOGLE_CAPTCHA_ENABLED`); set it to `"true"` to enable it.

## Versions

The version is the one in `pom.xml`: the OSGi bundle svarog runs, with `www/perun-core.js` inside it,
carries it as its `Bundle-Version`. Between releases `dev`'s pom names the next one with `-SNAPSHOT`, as
Maven expects.

`package.json` names the last version cut, a release or a release candidate, and the bundle's `version`
export reports it at runtime. Each is tagged with its number, as a lightweight tag, on the commit whose
`package.json` says it, and that commit's `www/perun-core.js` is a `pnpm build` of it.

- A candidate is cut on `dev`. It sets `package.json` to the pom's number with `-rc.N` (`4.5.8-rc.1`),
  rebuilds the bundle, and is tagged. The pom keeps its `-SNAPSHOT`, so nothing is released to Maven.
- A release starts on `dev` too: the commit that adds its section to `CHANGELOG.md` sets `package.json`
  to the release's number and rebuilds the bundle. `dev` is then merged into `main` with `--no-ff`, the
  merge setting the pom to the same number, and the merge is tagged (`4.5.8`). Pushing `main` deploys it
  to GitLab's Maven repository, and pushing the tag publishes it to Maven Central, from the GitHub
  mirror's release workflow. Back on `dev`, the next commit moves the pom to the next snapshot, and
  `package.json` stays until the next candidate.

Push each tag by name (`git push origin 4.5.8`); `--follow-tags` skips lightweight tags. A consumer
depends on perun-core by tag:

```json
"perun-core": "git+https://git@gitlab.prtech.mk/svarog4/perun-core#semver:^4.5.8-rc.1"
```

pnpm takes the newest tag in the range, and the lockfile records its commit. `^4.5.8-rc.1` takes
candidates of 4.5.8 and then 4.5.8 itself, once a `pnpm update perun-core` asks for it; `^4.5.8` skips
candidates, and `#4.5.8` pins one release. A consumer whose other git dependencies declare a
perun-core of their own names the same specifier in its overrides as well (`pnpm.overrides` in
`package.json` and `overrides` in `pnpm-workspace.yaml`), which is what makes them one copy.

A range takes every later version under the same major, on the next `pnpm update`. A change that a
module has to be adapted to therefore moves the major, not the patch.

The tags have to stay lightweight: for an annotated tag pnpm 9 and 10 record the tag's own hash and
pnpm 11 the commit's, and pnpm 11 then refuses a lockfile the others wrote. 4.5.0 to 4.5.7 were tagged
`v4.5.0` to `v4.5.7`, annotated, before this; they are retagged the same way now, on the same `main`
merges. Their `package.json` still says `0.2.0`, so that is the version pnpm lists for them.

## Local Development Guide

The following workflow applies both when developing `perun-core` itself and when developing a project that uses it as a dependency.

### Updating Perun Core Locally

1. Build perun-core:
   ```bash
   pnpm build
   ```
   Or use `pnpm build-dev` if you need source maps for debugging.
2. Copy `perun-core/www/perun-core.js` into your project at `your-project/node_modules/perun-core/www/`,
   along with the modules beside it (`tabler-icons-react.perun-core.js`, `pdfmake.perun-core.js`,
   `xlsx.perun-core.js`, `csv.perun-core.js`, `markdown.perun-core.js`). Those are loaded on demand
   from the same directory as the bundle, so a copy without them leaves the icon set, the user guides,
   the guide PDF export and the grids' Excel and CSV exports unable to load.

Since the built script is periodically committed to the repository, your project may already have a recent version of `perun-core.js` in `node_modules/perun-core/www/` after running `pnpm install`. This step is only necessary when you need changes that haven't been published yet.

### Running Perun Core Locally

`pnpm dev` serves the committed `www/index.html`, the page a deployment serves, so there is nothing in `www/` to create or edit. Everything it does not serve itself goes to one backend through a proxy, and that backend's origin is `PERUN_BACKEND`, set in an untracked `.env.local` at the repository root:

```bash
PERUN_BACKEND=http://<host>:<port>
```

or in the environment, which takes precedence over the file (`PERUN_BACKEND=http://<host>:<port> pnpm dev`). `.gitignore` covers `*.local`, so the file stays on your machine. Without it, `pnpm dev` stops at startup and says what is missing.

Open http://localhost:8080/. The page loads `window.server` from `../services/WsConf/getServer` and sweetalert2 from `../perun-assets/`, as it does deployed, and both reach the backend through the proxy, as do the API, the shared assets and the module bundles. The bundle, and the modules it loads on demand, come from `www/` under `/perun/`, rebuilt on every save. If a backend's `getServer` answers with an absolute `window.server` (its `frontend.server` property is a URL rather than `'/services'`), the dev server answers `/services` in its place, so the page still makes every request to localhost.

`www/config.js` is no longer used or tracked. A copy left in an older checkout can be deleted once its host is in `.env.local`.

### Setting Up a Module's Entry Point

A module repository's dev page is its own `backend/www/index.html`, and its dev server still reads the backend from a `config.js` beside it. Create these two files in `backend/www`:

**`config.js`** - Configure the server URL for your environment:

```js
window.server = 'http://<host>:<port>/services'
```

**`index.html`** - A minimal entry point that dynamically loads stylesheets and scripts:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div id="app"></div>
  <script src="config.js"></script>
  <script>
    const assetsUrl = `${window.server}/WsConf/params/get/sys/FRONTEND_ASSETS_LOCATION`
    fetch(assetsUrl).then(response => response.json()).then(res => {
      if (res.VALUE) {
        const assetsLocation = res.VALUE
        window.assets = assetsLocation;
        const server = window.server.substring(0, window.server.lastIndexOf('/'));

        // Load locale script
        // ...

        // Load custom stylesheets — list all available stylesheets for your environment
        const stylesheets = [
          'datagrid', 'forms', 'logon', 'homepage', 'style',
          'footer', 'loading', 'topnavmenu', 'sidelistmenu',
          'adminconsole', 'modal', 'userguide', 'not-found-page',
          // ... add more as needed
        ];
        // Each entry loads: ${server}${assetsLocation}/styles/${name}.css

        // Load Font Awesome stylesheets
        // ...

        // Load title script
        // ...
      }
    }).catch(err => console.log(err))
  </script>
  <!-- Replace with your project's bundle filename -->
  <script src="bundle-name.js"></script>
</body>
</html>
```

> **Note:** This is a simplified template. The full boilerplate is available at [`docs/index.html.template`](docs/index.html.template) — copy it into your project's `backend/www` directory and customize as needed.

### Server Unavailability Handling

`index.html` loads `sweetalert2.all.min.js` from the assets server before the inline script runs. If the backend is temporarily unavailable (e.g. during a restart or deploy), the `getServer` script will fail to set `window.server`, and a SweetAlert2 dialog will be shown instead of a blank page.

Make sure `sweetalert2.all.min.js` is present in your assets project at `perun-assets/js/`. The file can be obtained from the [SweetAlert2 releases page](https://github.com/sweetalert2/sweetalert2/releases).

To simulate a server unavailability scenario locally, block the `getServer` request in your browser's DevTools under **Network > Block request URL**, then reload the page.

### Spatial Support

Spatial settings do not go in `index.html`. They are system parameters (`SVAROG_SYS_PARAMS`) at the environment level, which perun-atlas reads at startup and hands to the spatial engine. A map needs these two, and without either one perun-atlas stops at startup and names the missing parameter:

| System Parameter | Example value |
|------------------|---------------|
| `SPATIAL_CRS` | `EPSG:3857` |
| `SPATIAL_CENTER` | `{"lat": 41.294, "lng": 74.597}` |

The optional ones (`SPATIAL_BOUNDS`, `SPATIAL_ZOOM`, `SPATIAL_MEASUREMENT_SYSTEM` and the rest) are listed in perun-atlas's `frontend/config/Schema.js`. The `window.sysCrs` and `window.sysCenter` globals that older pages set, and the `SYS_CRS` and `SYS_CENTER` parameters behind them, are not needed.

### Icons

Perun Core includes the [`@tabler/icons-react`](https://www.npmjs.com/package/@tabler/icons-react) icon library. Browse the available icons at https://tabler.io/icons.

When developing a project, replace the `Icon` component at `frontend/elements/util/Icon.js` with the following static import version:

```jsx
import React from 'react'
import * as TablerIcons from '@tabler/icons-react'

const Icon = ({ name, ...props }) => {
  const IconComponent = TablerIcons[name]
  return IconComponent ? <IconComponent {...props} /> : null
}

export default Icon
```

After replacing the component, rebuild perun-core:

```bash
pnpm build
```

> **Why?** The default `Icon` component loads the icon set on demand, from a module beside the bundle. The static import version above bundles all icons upfront, which is simpler for local development of dependent projects.
