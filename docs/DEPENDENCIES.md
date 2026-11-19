# Dependencies

The lockfile is the reproducible dependency reference. Runtime licenses are collected in `THIRD_PARTY_NOTICES.md`; Electron includes its own license and Chromium notices in distributed bundles.

| Area                | Main packages                             |
| ------------------- | ----------------------------------------- |
| UI                  | React, React DOM, lucide-react            |
| Canvas              | Konva, react-konva                        |
| ZIP export          | JSZip                                     |
| MCP protocol        | Official `@modelcontextprotocol/sdk`, Zod |
| Agent configuration | jsonc-parser, @iarna/toml                 |
| Desktop             | Electron, Electron Builder                |
| Verification        | TypeScript, ESLint, Vitest, Playwright    |

Run `npm run notices:generate` after changing production dependencies. The generator includes transitive runtime packages and their license texts where available. Review missing package notices before a release. Run both `npm audit --omit=dev` and `npm audit`; a build-tool advisory is not evidence of a runtime exploit, and a clean runtime audit does not replace review.
