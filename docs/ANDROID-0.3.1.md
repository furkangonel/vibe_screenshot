# Android / Google Play — 0.3.1

Added three Google Play screenshot targets, each with portrait and landscape canvases:

| Target                 | Portrait    | Landscape   |
| ---------------------- | ----------- | ----------- |
| Android phone          | 1080 × 1920 | 1920 × 1080 |
| 7-inch Android tablet  | 1440 × 2560 | 2560 × 1440 |
| 10-inch Android tablet | 2160 × 3840 | 3840 × 2160 |

These are convenient working resolutions, not device-specific pixel sizes mandated by Google.
They use the 9:16 / 16:9 store aspect ratios. See the current
[Google Play preview asset guidelines](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
Use screenshots of the actual Android phone/tablet experience.

The phone has a centered punch-hole camera, graphite/silver/sage finishes and a 1080 × 2400
display aperture. The 7-inch and 10-inch tablet frames have 16:10 display apertures and
graphite/silver finishes. These are original generic illustrations, not official hardware artwork.
Device orientation, cropping, translated screenshots and PNG exports use the same existing renderer.

## Existing projects and data

- Existing project files, device IDs, localizations and stored layouts are unchanged.
- Open an existing project and choose a missing Android target under **Add Google Play canvas**
  in **Output**. This adds one blank canvas through the existing undo/save flow.
- New example projects include Android examples, disabled for ZIP export until enabled explicitly.
- Google Play canvases support up to eight screenshots; existing iOS canvases retain their limits.
- The database schema, database name, secure `vibe://app` origin, desktop app ID, package name
  and user data location are unchanged. No data migration or clearing is required.

Before updating an installed desktop build, quit after saving and back up both the application
bundle and its `~/Library/Application Support/vibe-screenshots` directory. Test the packaged
update with a separate profile before replacing the installed bundle.
