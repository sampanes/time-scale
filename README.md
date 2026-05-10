# To Scale: Time

A static single-file timeline app for showing geological, historical, and future events on a true to-scale timeline.

## Local Preview

There is no package install and no local build step right now.

Open `to-scale-time.html` directly in a browser.

## GitHub Pages Deployment

This repo deploys with GitHub Actions from `.github/workflows/pages.yml`.

The workflow:

1. Runs on pushes to `main`, pull requests targeting `main`, and manual dispatches.
2. Copies `to-scale-time.html` into `_site/index.html`.
3. Also copies it to `_site/to-scale-time.html` so the old direct URL keeps working.
4. Uploads `_site` as the GitHub Pages artifact.
5. Deploys the artifact to GitHub Pages on non-pull-request runs.

In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

## Build Contract

For now, `to-scale-time.html` is the canonical source file. If the app later grows into multiple files or a framework build, update the workflow so the final static output still lands in `_site`.

The published site expects an `index.html` file at the artifact root.
