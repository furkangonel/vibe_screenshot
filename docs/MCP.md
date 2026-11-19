# Local MCP guide

MCP is available in the desktop app. It is **off by default**. The studio must be open to handle project operations. The browser editor does not expose a local server.

## Connect from the app

Open **Settings → Agent connections**, enable MCP, review a client’s configuration, then select **Connect**. Codex, Claude Code, Claude Desktop, Cursor, and VS Code are supported. Detection checks known local configuration/application paths; it is a setup hint, not a live process check. Reload or restart your client after changing its configuration.

Only the `vibe-screenshots` entry is merged. Existing files are copied to a timestamped `.vibe-backup-*` file before an atomic write. JSONC comments and unrelated values are retained; existing TOML text is preserved around a marked managed section. If the same server name is owned by a custom configuration, the app stops and asks you to resolve it manually. Unreadable or symbolic configuration files are not overwritten. Disconnect removes only the app’s entry. Turning MCP off leaves the configuration in place so it can reconnect later.

| Client         | User configuration                                          |
| -------------- | ----------------------------------------------------------- |
| Codex          | `$CODEX_HOME/config.toml`, otherwise `~/.codex/config.toml` |
| Claude Code    | `~/.claude.json`                                            |
| Cursor         | `~/.cursor/mcp.json`                                        |
| Claude Desktop | OS app-data directory / `Claude/claude_desktop_config.json` |
| VS Code        | OS app-data directory / `Code/User/mcp.json`                |

OS app data means `~/Library/Application Support` on macOS, `%APPDATA%` on Windows, or `$XDG_CONFIG_HOME` / `~/.config` on Linux. Custom client profiles, remote containers and nonstandard configuration locations may need manual setup. VS Code uses a `servers` root; the other JSON clients use `mcpServers`.

For example, a generated JSON entry has this structure. The app supplies the actual absolute paths for your installation:

```json
{
  "mcpServers": {
    "vibe-screenshots": {
      "command": "/path/to/the/desktop/executable",
      "args": [
        "/path/to/app.asar/electron/stdio-bridge.cjs",
        "--connection",
        "/path/to/app-profile/mcp-connection.json"
      ],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

No token is copied into the client configuration. The stdio bridge uses the app’s bundled runtime and reads the local connection file. You do not need Node.js installed to use a packaged app. Moving the application or switching to another app profile may require connecting again in Settings. Existing clients may require a new chat/session before newly added tools appear.

## Access and exports

Connected clients can read and edit the loaded local project library, including images and localized copy. Connect only clients you trust. The client’s own tool approval flow still applies. The app provides no shell tool, arbitrary file reader/writer, or project-delete tool.

The Streamable HTTP listener binds only to `127.0.0.1` (default port 37891). Requests need the random local bearer token, a permitted Host header, and no browser Origin header. Settings can change the port if it is occupied. The connection file is written with restrictive permissions on supported systems. Never share it. Disabling MCP closes the listener and marks the connection file inactive.

Exports use generated filenames in the app profile’s `exports` folder and never overwrite existing files. Choose **Connection details → Open export folder** to view them. PNGs are opaque and use the exact preset dimensions. ZIP exports include a manifest and support up to 300 screenshot renders per MCP call; split larger jobs into language batches. Preview images are limited to 1200 pixels on the longest side.

Project IDs identify library entries, document IDs identify canvases, and layer IDs identify objects inside a canvas. Coordinates are canvas pixels; screenshot indices start at zero. Call `projects_list`, `presets_list`, and `devices_list` before editing. Tool read responses omit embedded image strings unless explicitly requested with `project_get.includeImages`.

Mutations are validated before they reach the workspace. Omitted fields are preserved. Saved projects use the normal serialized save queue; session-only edits remain session-only until saving is enabled in the app. Undo/redo applies to the active project, so open the intended project before using history tools. Agent activity shows method, success/failure, time, and duration in Settings; it does not log project content or tokens.

## Tools

| Tool                  | Access | Purpose                                                                                                                                           |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_status`          | Read   | Read app version, active project, saving state and automation capabilities.                                                                       |
| `presets_list`        | Read   | List exact App Store, Google Play and creative canvas sizes.                                                                                      |
| `devices_list`        | Read   | List device frames, colors, screen geometry and supported orientations.                                                                           |
| `projects_list`       | Read   | List local project IDs, names, saved state, languages and output counts. Does not include image data.                                             |
| `project_get`         | Read   | Read a project. Embedded images are omitted unless includeImages is true.                                                                         |
| `project_create`      | Edit   | Create a new saved project. Examples are optional; returns its project ID.                                                                        |
| `project_duplicate`   | Edit   | Duplicate a project as a separate saved project, preserving its images and translations.                                                          |
| `project_update`      | Edit   | Update project name, notes or default language; preserves outputs and images.                                                                     |
| `project_import`      | Edit   | Validate and import a complete project JSON as a new saved project. Never overwrites an existing project.                                         |
| `project_open`        | Edit   | Open a project in the studio.                                                                                                                     |
| `project_save`        | Edit   | Flush the current local save queue. Session-only projects must be saved using the app first.                                                      |
| `documents_list`      | Read   | List the project canvas IDs, dimensions and screenshot counts.                                                                                    |
| `document_add`        | Edit   | Add one canvas using an exact preset ID. Returns the new canvas ID.                                                                               |
| `document_update`     | Edit   | Update canvas name, pageCount, enabled or background. Geometry stays tied to its preset; omitted fields remain unchanged.                         |
| `screenshots_reorder` | Edit   | Move a screenshot using zero-based from/to indices. Preserves seam content, localized layers and backgrounds.                                     |
| `layers_list`         | Read   | Read canvas layers with embedded images omitted.                                                                                                  |
| `layer_add`           | Edit   | Add a text, device, image or shape layer. Properties use canvas pixels. Supply translationKey for text, deviceId for devices, and src for images. |
| `layer_update`        | Edit   | Patch a layer without replacing omitted properties or its images. ID and type cannot change. Use locale for translated text geometry.             |
| `layer_duplicate`     | Edit   | Duplicate a layer and its embedded images.                                                                                                        |
| `layer_remove`        | Edit   | Remove one layer. This edit can be undone in the active project.                                                                                  |
| `layer_reorder`       | Edit   | Change a layer stacking index; zero is the back.                                                                                                  |
| `device_set_screen`   | Edit   | Set a device screenshot from a PNG, JPEG or WebP data URI. Optional locale limits it to one content language.                                     |
| `device_orient`       | Edit   | Rotate a flat device to portrait or landscape, keeping the screenshot upright.                                                                    |
| `device_crop`         | Edit   | Crop the complete device non-destructively with normalized 0–1 bounds; reset restores the full casing.                                            |
| `localizations_get`   | Read   | Read the localization matrix and translation key order.                                                                                           |
| `localizations_set`   | Edit   | Merge translations by key and locale. Existing translations are preserved.                                                                        |
| `locales_set`         | Edit   | Set the enabled content languages using the supported locale catalog. Existing translation values are retained.                                   |
| `locales_list`        | Read   | List the 28 supported content languages.                                                                                                          |
| `preview_render`      | Read   | Render a screenshot preview as an image (maximum 1200px). Indices are zero-based.                                                                 |
| `export_png`          | Edit   | Export a full-resolution opaque PNG into the app export folder. Returns its local path; does not overwrite files.                                 |
| `export_zip`          | Edit   | Export selected canvases and languages as a ZIP with a manifest into the app export folder.                                                       |
| `export_project`      | Edit   | Export a portable project JSON including embedded images into the app export folder.                                                              |
| `history_undo`        | Edit   | Undo the most recent edit in the active project.                                                                                                  |
| `history_redo`        | Edit   | Redo the most recent undone edit in the active project.                                                                                           |

## Resource and prompt

`vibe://reference` lists the tool workflow and coordinate conventions. The `compose-store-screenshots` prompt accepts an app name and optional audience, and asks the agent to gather real product features and screenshots before composing and previewing assets. It does not generate claims about your product.

## Troubleshooting

- **No tools:** enable MCP, keep the studio open, then restart/reload the client. Some clients only discover tools in a new session.
- **Port occupied:** change Local port in Connection details and apply it. The generated bridge follows the connection file, so changing the port does not require editing client files.
- **Configuration conflict:** review the existing `vibe-screenshots` entry in the client. Unmanaged entries are intentionally not replaced.
- **Client not detected:** check its documented user configuration path. The manual preview can be copied to a custom location. Remote/cloud agents cannot reach this machine’s loopback endpoint.
- **Project missing:** the desktop and browser libraries are separate. Import a portable project file into the desktop app.
- **Invalid layer or canvas:** fetch IDs again. Preset geometry and project schema are validated; unknown IDs, remote image URLs, and invalid page counts are rejected.

Protocol and client references: [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server), [Codex MCP](https://developers.openai.com/codex/mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Cursor MCP](https://docs.cursor.com/context/model-context-protocol), [VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
