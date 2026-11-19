# Releasing

The project uses calendar-style semantic versions such as `2026.11.1` and matching tags such as `v2026.11.1`.

## Prepare

1. Update `package.json`, the root package entry in `package-lock.json`, and `CHANGELOG.md` together.
2. Run `npm ci`, `npm run check`, and `npm run test:e2e` with Playwright’s browser installed.
3. Run `npm run desktop:pack`, then test the actual packaged executable using `VIBE_PACKAGED_EXECUTABLE` with `npm run test:desktop` and `npm run test:mcp`. Linux requires a display server.
4. Test an upgrade with a copied user profile. Check saved project contents and images, not just the visible project names. Never run tests against the only copy of a personal library.
5. Run `npm audit --omit=dev` and review the full build-tool audit separately. Review dependencies and artwork licenses.
6. Generate documentation images from the fictional demo. Keep personal projects, `.local/`, credentials, and client configurations out of Git.

The `appId`, package name, `vibe://app` origin, IndexedDB name/version, and existing project/device IDs must remain stable unless an explicit compatible migration is provided.

## Publish

```sh
git tag -a v2026.11.1 -m "Vibe Screenshots 2026.11.1"
git push origin main
git push origin v2026.11.1
```

`.github/workflows/release.yml` validates the tag against `package.json`, runs checks and browser tests, then builds installers on native macOS, Windows, and Linux runners. Each platform job also runs the packaged desktop and MCP tests. A final job downloads all successful build artifacts, generates `SHA256SUMS.txt`, and creates the GitHub release with those files and the matching changelog section. A failed platform build prevents a partial release.

The workflow’s `GITHUB_TOKEN` receives `contents: write` only in the final publishing job. No personal access token is required in repository secrets. Manual workflow dispatch builds artifacts but does not publish an untagged release.

## Current distribution limits

Installers are unsigned and macOS packages are not notarized. The workflow explicitly disables automatic signing identity discovery; it never requests or embeds a developer’s local signing credentials. Add a documented signing/notarization workflow before advertising signed distribution. There is no automatic app updater.

Public builds must use the repository’s original vector artwork. Do not copy `.local/legacy-device-artwork` into a public build unless its distribution rights have been independently established. See the attribution document.
