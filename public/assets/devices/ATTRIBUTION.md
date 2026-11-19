# Device frames

The SVG device shells in this directory are original geometric illustrations
created by `scripts/generate-frames.mjs`, distributed under the project's MIT
license. They include layered metal edges, antenna bands, side buttons and optical
glass details. They are generic mockups, not official product images.

The Android phone and 7-inch/10-inch tablet shells are also original SVG illustrations.
Their screen apertures are defined in `src/androidDevices.json` and shared with the renderer
and frame generator. They do not use Apple or third-party Android product artwork.

## Optional local high-resolution artwork

When `.local/legacy-device-artwork/<device-id>/<color>.png` exists, the app uses
that full-resolution frame in both the editor and exported images. Vite discovers
these optional files during development/build; no remote download or separate
runtime request is required. Existing project IDs, screen apertures and geometry
are preserved. A missing local variant uses its original vector fallback.

The prior project's PNG artwork is preserved in that local directory. Its original
attribution identifies Monkr and Apple Design Resources. These files are not
covered by this repository's MIT license; their existing rights and usage terms
remain applicable. The source archive and Git ignore `.local/`. A desktop/web build
made with that optional pack contains its rendered source files, so distribution
of that build requires appropriate artwork rights. Check the notice shipped with
the local pack before redistributing it.

Internal device IDs retain previous names for project-file compatibility. They
do not identify or certify actual products. The custom foldable output is a design
canvas, not a guarantee of store acceptance.
