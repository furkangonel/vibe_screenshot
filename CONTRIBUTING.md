# Contributing

Vibe Screenshots is a local screenshot editor built with React, TypeScript, Konva, and Electron. Small, focused pull requests are easiest to review. Open an issue before undertaking a large feature or changing the project format.

## Development

Use the Node version in `.nvmrc` and run `npm ci`. `npm run dev` starts the browser editor. `npm run desktop` builds and launches Electron. For hot reload, run Vite on loopback port 5173 and `npm run desktop:dev` separately.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:desktop
npm run test:mcp
```

Desktop tests and MCP tests use temporary app profiles and fake agent homes. On Linux, run desktop checks under Xvfb. Do not use your personal app profile or client configuration for automated tests.

## Keep these boundaries intact

- Preserve existing project, layer, and preset IDs. Migrations must be non-destructive and covered by a regression test.
- Keep editor and exported pixels consistent. Device geometry belongs in shared definitions, not separate preview and export hacks.
- Keep MCP off by default and bound to loopback. Never expose generic filesystem, shell, or unrestricted IPC methods.
- Validate an entire project before committing automation edits. Merge omitted fields rather than replacing images, copy, or geometry.
- Keep other agents’ configuration and comments intact. Back up before writing and refuse unreadable or conflicting settings.
- Add English and Turkish strings together. Interface language is independent of project content languages.
- Honor keyboard focus, reduced motion, and narrow windows. Give icon buttons accessible names.
- Include only original or appropriately licensed artwork. Never commit real project files, screenshots, tokens, client settings, or private artwork packs.

## Documentation and pull requests

Explain the user-visible problem, the resulting behavior, and relevant validation. Add regression coverage for data loss, protocol/security boundaries, rendering, or complex interaction changes. Avoid tests that merely repeat an implementation.

Documentation images are generated from the fictional Daylight demo in a clean profile using `npm run docs:capture`. Do not capture your personal library. Update the MCP catalog when adding a tool and keep release notes factual.

By contributing, you agree that your contribution is distributed under the project’s MIT license. Report security issues privately as described in [SECURITY.md](SECURITY.md).
