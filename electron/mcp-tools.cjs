const { z } = require('zod');
const id = z.string().min(1).max(200);
const project = { projectId: id };
const canvasArgs = { ...project, documentId: id };
const layer = { ...canvasArgs, layerId: id };
const json = z.record(z.string(), z.unknown());
const image = z
  .string()
  .max(28_000_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,/);
const tools = [
  ['app_status', 'Read app version, active project, saving state and automation capabilities.', {}, true],
  ['presets_list', 'List exact App Store, Google Play and creative canvas sizes.', {}, true],
  ['devices_list', 'List device frames, colors, screen geometry and supported orientations.', {}, true],
  [
    'projects_list',
    'List local project IDs, names, saved state, languages and output counts. Does not include image data.',
    {},
    true,
  ],
  [
    'project_get',
    'Read a project. Embedded images are omitted unless includeImages is true.',
    { ...project, includeImages: z.boolean().default(false) },
    true,
  ],
  [
    'project_create',
    'Create a new saved project. Examples are optional; returns its project ID.',
    { name: id, examples: z.boolean().default(false), defaultLocale: z.string().default('en-US') },
  ],
  [
    'project_duplicate',
    'Duplicate a project as a separate saved project, preserving its images and translations.',
    { ...project, name: id },
  ],
  [
    'project_update',
    'Update project name, notes or default language; preserves outputs and images.',
    {
      ...project,
      name: id.optional(),
      notes: z.string().max(10000).optional(),
      defaultLocale: id.optional(),
    },
  ],
  [
    'project_import',
    'Validate and import a complete project JSON as a new saved project. Never overwrites an existing project.',
    { project: json },
  ],
  ['project_open', 'Open a project in the studio.', project],
  [
    'project_save',
    'Flush the current local save queue. Session-only projects must be saved using the app first.',
    project,
  ],
  ['documents_list', 'List the project canvas IDs, dimensions and screenshot counts.', project, true],
  [
    'document_add',
    'Add one canvas using an exact preset ID. Returns the new canvas ID.',
    { ...project, presetId: id, examples: z.boolean().default(false) },
  ],
  [
    'document_update',
    'Update canvas name, pageCount, enabled or background. Geometry stays tied to its preset; omitted fields remain unchanged.',
    { ...canvasArgs, patch: json },
  ],
  [
    'screenshots_reorder',
    'Move a screenshot using zero-based from/to indices. Preserves seam content, localized layers and backgrounds.',
    { ...canvasArgs, from: z.number().int().nonnegative(), to: z.number().int().nonnegative() },
  ],
  ['layers_list', 'Read canvas layers with embedded images omitted.', canvasArgs, true],
  [
    'layer_add',
    'Add a text, device, image or shape layer. Properties use canvas pixels. Supply translationKey for text, deviceId for devices, and src for images.',
    { ...canvasArgs, type: z.enum(['text', 'device', 'image', 'shape']), properties: json },
  ],
  [
    'layer_update',
    'Patch a layer without replacing omitted properties or its images. ID and type cannot change. Use locale for translated text geometry.',
    { ...layer, patch: json, locale: id.optional() },
  ],
  ['layer_duplicate', 'Duplicate a layer and its embedded images.', layer],
  ['layer_remove', 'Remove one layer. This edit can be undone in the active project.', layer, false, true],
  [
    'layer_reorder',
    'Change a layer stacking index; zero is the back.',
    { ...layer, index: z.number().int().nonnegative() },
  ],
  [
    'device_set_screen',
    'Set a device screenshot from a PNG, JPEG or WebP data URI. Optional locale limits it to one content language.',
    { ...layer, image, locale: id.optional() },
  ],
  [
    'device_orient',
    'Rotate a flat device to portrait or landscape, keeping the screenshot upright.',
    { ...layer, orientation: z.enum(['portrait', 'landscape']) },
  ],
  [
    'device_crop',
    'Crop the complete device non-destructively with normalized 0–1 bounds; reset restores the full casing.',
    {
      ...layer,
      reset: z.boolean().default(false),
      crop: z
        .object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().positive().max(1),
          height: z.number().positive().max(1),
        })
        .optional(),
    },
  ],
  ['localizations_get', 'Read the localization matrix and translation key order.', project, true],
  [
    'localizations_set',
    'Merge translations by key and locale. Existing translations are preserved.',
    { ...project, copy: z.record(z.string(), z.record(z.string(), z.string().max(10000))) },
  ],
  [
    'locales_set',
    'Set the enabled content languages using the supported locale catalog. Existing translation values are retained.',
    { ...project, codes: z.array(id).min(1).max(28) },
  ],
  ['locales_list', 'List the 28 supported content languages.', {}, true],
  [
    'preview_render',
    'Render a screenshot preview as an image (maximum 1200px). Indices are zero-based.',
    { ...canvasArgs, locale: id, page: z.number().int().nonnegative().default(0) },
    true,
  ],
  [
    'export_png',
    'Export a full-resolution opaque PNG into the app export folder. Returns its local path; does not overwrite files.',
    { ...canvasArgs, locale: id, page: z.number().int().nonnegative().default(0) },
  ],
  [
    'export_zip',
    'Export selected canvases and languages as a ZIP with a manifest into the app export folder.',
    { ...project, documentIds: z.array(id).min(1), locales: z.array(id).min(1).max(28) },
  ],
  [
    'export_project',
    'Export a portable project JSON including embedded images into the app export folder.',
    project,
  ],
  ['history_undo', 'Undo the most recent edit in the active project.', {}],
  ['history_redo', 'Redo the most recent undone edit in the active project.', {}],
];
module.exports = { tools };
