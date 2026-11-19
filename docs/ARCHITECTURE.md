# Architecture

## Renderer

`src/App.tsx` composes project navigation, studio panels, localizations, export dialogs, and settings. `useWorkspace.ts` owns the library, active project, save queue, and undo/redo history. Active-project edits enter history; edits targeted at another project do not overwrite the active project or its history.

Projects are versioned JSON documents. They contain output canvases, layers, localized copy, and embedded image data. `projectValidation.ts` validates imports and automation mutations. `projectMigration.ts` handles legacy device layouts without resetting the library. IndexedDB remains `vibe-screenshots-db`, version 2, with the `library` store; preferences use the `vibe:` localStorage prefix.

`CanvasEditor.tsx` renders the interactive Konva canvas. `exporter.ts` uses the shared device layout, clipping, and fold geometry for opaque PNGs and ZIPs. `deviceLayout.ts`, `deviceScreenPath.ts`, and the fold renderers define the common geometry. `androidDevices.json` is shared by Android frame generation and renderer device definitions.

`guideGeometry.ts` computes alignment, size, and equal-gap snapping. `SmartGuides.tsx` draws temporary overlays at screen-pixel scale. Guides are excluded from the export renderer. Holding Alt bypasses snapping.

## Desktop

`electron/main.cjs` owns the window, local protocol, native menus, download behavior, and MCP service. macOS uses an inset native titlebar. The renderer remains sandboxed with context isolation and no Node integration. `preload.cjs` exposes a small set of named IPC methods. Main-process handlers validate the sending frame.

The application ID, package name, secure origin, database identity, and user data location stay stable across releases. Replacing the app bundle does not replace the user profile.

## MCP

`mcp-service.cjs` runs an authenticated, stateless Streamable HTTP MCP endpoint on loopback. It registers the schemas in `mcp-tools.cjs` with the official MCP SDK. The endpoint is disabled by default. Requests are size-limited; mutating tool calls are serialized to avoid cross-request lost updates.

A tool call travels through named IPC to `useDesktopAutomation.ts`. Read operations query the loaded workspace. Mutations use the pure functions in `automation.ts`, validate the resulting project, then enter the workspace update/save flow. PNG, ZIP, and project exports are created by the renderer and written by the main process into its fixed export directory.

`stdio-bridge.cjs` has no third-party dependencies. A client starts it using the Electron executable in Node mode. It reads the app profile’s local connection file and forwards newline-delimited JSON-RPC to the authenticated loopback endpoint. It does not launch a second studio or access project files itself.

`agent-config.cjs` detects fixed client paths, prepares configuration previews, and merges one managed entry. TOML comments and unrelated tables are preserved; JSONC is edited structurally. Existing files are backed up before an atomic replacement. Malformed files, symlink targets, and unmanaged server-name conflicts stop the write.

## Packaging and public assets

Electron Builder packages the renderer, desktop scripts, and production dependencies. Public CI builds contain original repository SVG frames. Optional private artwork under `.local/` is neither committed nor present in clean CI builds.

The tag release workflow verifies the code, builds macOS arm64/x64, Windows x64, and Linux x64 installers, and publishes a GitHub release only after all platform builds succeed. Documentation imagery is generated from `demoProject.ts` in a clean test profile.
