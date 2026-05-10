# To Scale: Time

A static timeline app for showing geological, historical, and future events on a true to-scale timeline.

## Local Preview

There are no runtime dependencies.

Build the static site:

```sh
npm run build
```

Then serve the artifact directory:

```sh
python -m http.server 8000 -d _site
```

Open `http://localhost:8000/`.

The app now uses ES modules, so opening `index.html` directly from the filesystem is not a reliable local preview path.

## Project Layout

- `index.html` - current app shell and GitHub Pages entry point.
- `to-scale-time.html` - compatibility redirect for the old direct URL.
- `src/data/timeline-data.js` - timeline database, type colors, and presets.
- `src/lib/search.js` - DOM-free fuzzy search utilities.
- `src/lib/time-scale.js` - DOM-free Ma formatting, range, tick, linear, and log-scale helpers.
- `src/lib/timeline-view-model.js` - converts selected timeline items into renderable segment/tick data.
- `src/app.js` - current UI glue. This should be the easiest file to replace during a GUI rewrite.
- `src/styles.css` - current visual styling.
- `scripts/build-site.mjs` - creates the `_site` folder that GitHub Pages deploys.

## GitHub Pages Deployment

This repo deploys with GitHub Actions from `.github/workflows/pages.yml`.

The workflow:

1. Runs on pushes to `main`, pull requests targeting `main`, and manual dispatches.
2. Runs `npm run build`.
3. Uploads `_site` as the GitHub Pages artifact.
4. Deploys the artifact to GitHub Pages on non-pull-request runs.

In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

[Here's Mine](https://sampanes.github.io/time-scale/)

## Build Contract

For now, `index.html` and `src/` are the canonical source files. If the app later grows into a framework build, keep `npm run build` as the command that writes the final static output to `_site`.

The published site expects an `index.html` file at the artifact root.
