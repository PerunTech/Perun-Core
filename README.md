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
| `pnpm dev` | Serves `www/index.html` on port 8080 with the bundle rebuilt on every save (unminified, source maps, debug) and the page reloaded after each rebuild. The bundle is served under `/perun/`, as a deployment serves it, so its sources show under `/perun/frontend/` in DevTools. Everything else is proxied to the backend that `window.server` names in `www/config.js` |
| `pnpm lint` | Lints `frontend/` with oxlint; fails on an error |
| `pnpm lint:fix` | The same, fixing what oxlint can |

## Environment Variables

This project has no required build-time environment variables. Google Analytics is configured at runtime via the `GOOGLE_ANALYTICS_ID` system parameter fetched from the server (`WsConf/params/get/sys/GOOGLE_ANALYTICS_ID`). reCAPTCHA is loaded conditionally based on the `GOOGLE_CAPTCHA_ENABLED` system parameter (`WsConf/params/get/sys/GOOGLE_CAPTCHA_ENABLED`); set it to `"true"` to enable it.

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
   `xlsx.perun-core.js`). Those are loaded on demand from the same directory as the bundle, so a copy
   without them leaves the icon set, the guide PDF export and the grids' Excel export unable to load.

Since the built script is periodically committed to the repository, your project may already have a recent version of `perun-core.js` in `node_modules/perun-core/www/` after running `pnpm install`. This step is only necessary when you need changes that haven't been published yet.

### Setting Up the Frontend Entry Point

Create the following files in the `www` directory when developing Perun Core, or `backend/www` when developing other projects.

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
    // If your project uses spatial features, add these (see Spatial Support section):
    // window.sysCrs = 'EPSG:3857'
    // window.sysCenter = { lat: 41.294, lng: 74.597 }
  </script>
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

If your project uses spatial features, you must manually add the following parameters to `index.html` (inside a `<script>` tag, before other scripts):

```js
window.sysCrs = 'EPSG:3857'
window.sysCenter = { lat: 41.294, lng: 74.597 }
```

These values correspond to the following system parameters (`SVAROG_SYS_PARAMS`) at the environment level:

| Window Variable | System Parameter |
|-----------------|------------------|
| `window.sysCrs` | `SYS_CRS` |
| `window.sysCenter` | `SYS_CENTER` |

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
