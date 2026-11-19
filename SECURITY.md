# Security policy

Report vulnerabilities using [GitHub’s private vulnerability reporting](https://github.com/furkangonel/vibe_screenshot/security/advisories/new) when available. If it is unavailable, open an issue asking for a private contact without including exploit details, credentials, or project data. Include the affected release and a minimal reproduction. There is no guaranteed response time.

## Desktop boundary

The Electron renderer uses sandboxing and context isolation. Node integration is off, permission requests are denied, and external navigation and new windows are blocked. Production assets load from a secure local `vibe://app` origin with a restrictive Content Security Policy. The preload exposes named settings and automation messages, not generic shell or filesystem access. IPC handlers check the sender and frame URL.

Imported projects and automation edits pass through the same project validator. Image sources must be embedded PNG, JPEG, or WebP data; remote image URLs are rejected. The Vite development server must remain on loopback.

## MCP boundary

MCP is disabled by default. Enabling it permits authenticated local clients to read and edit **all projects loaded in this app profile**, including their images and translations. Connect only agents you trust. Client-side tool approvals and model behavior remain the client’s responsibility.

The listener binds to `127.0.0.1`, validates the Host header, rejects browser Origin headers, requires a random bearer token, and limits request sizes and connections. Disabling MCP closes the listener. The connection token is stored in the local app profile with restrictive file permissions on systems that support them; it is not included in generated agent configurations, portable projects, or the UI status API. The stdio bridge reads that connection file and only forwards to its loopback endpoint.

Tools cannot run shell commands or read arbitrary files. Exports are written to the app’s export directory using new generated filenames. There is no MCP project-delete tool. Layer removal is marked destructive in tool annotations; active-project edits use the normal undo history.

Agent detection reads known paths only. Configuration writes are limited to the supported clients’ fixed configuration files. Existing files are backed up, unrelated settings are preserved, parse failures stop the write, and unmanaged name conflicts require manual resolution. Symbolic configuration files must be edited manually.

## Local data and distribution

Saved projects are not encrypted or cloud-backed by this app. Someone with access to the OS profile can read them. Keep credentials out of project notes and screenshots. Export project files for backups.

Public release builds use repository-owned vector artwork. Installer packages are currently unsigned and macOS builds are not notarized. Release workflows build from a versioned Git tag and attach platform installers and SHA-256 checksums. Inspect checksums and provenance according to your environment’s requirements.

Before a release, run `npm audit` and distinguish production dependencies from build tooling. Do not downgrade Electron or disable certificate verification to silence an advisory. Document unresolved findings and update affected packages when a compatible fix exists.
