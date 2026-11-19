# Verification

## Release 2026.11.1

The local verification environment is macOS arm64 with Node.js 24.21.0. CI uses the version in `.nvmrc`. Verification is reproducible with the commands in the root README.

Coverage includes project validation and legacy migration; serialized IndexedDB saves; localized copy and geometry; Android portrait/landscape output; screen masks and cropped device pixels; selection, layer ordering and screenshot reordering; alignment and equal-gap geometry; independent panels and remembered settings; opaque PNG and ZIP exports; and cancellation.

MCP verification uses the official client for initialization, tool discovery, resources, prompts, schema validation, authenticated calls, Host/Origin rejection, and disabling the local listener. Configuration tests exercise JSONC/TOML preservation, name conflicts, backups, idempotency, and symbolic-file rejection.

The packaged desktop smoke tests exercise sandboxed startup, the secure local origin, frame decoding, save/relaunch, real renderer-driven MCP editing, translated layout, PNG/ZIP/project exports, the generated stdio configuration, and persisted MCP state. These tests use temporary profiles and fake client homes. They do not edit personal project libraries or agent settings.

Clean public builds use the original SVG artwork. Optional photographic local artwork is tested separately when used in a private local build. Corner tests account for visible vector bezels while still checking that screen content does not leak.

Documentation captures use only the fictional Daylight demo, drawn in `src/demoProject.ts`, in a new browser profile. The connection screenshot is explicitly illustrative. No personal app screenshots or project data are used.

Windows and Linux packages are built and tested on their native GitHub Actions runners by the release workflow. A successful local macOS test does not establish Windows or Linux compatibility; their workflow jobs must pass before a release is published. All installers remain unsigned and macOS builds are not notarized.
