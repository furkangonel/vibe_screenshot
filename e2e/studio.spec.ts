import { openStudio, setInterfaceLanguage } from './ui';
import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import JSZip from 'jszip';

test('creates isolated projects, remembers only saved ones, and keeps the interface language', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Name your project').fill('Atlas');
  await page.getByRole('dialog').getByLabel('Project notes').fill('Travel app · autumn launch');
  await page.getByLabel('Start with example layouts').uncheck();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Atlas');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(1);
  await expect(page.locator('.save-state')).toContainText('Saved on this device');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Name your project').fill('Temporary');
  await page.getByRole('dialog').getByLabel('Save on this device').uncheck();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.locator('.save-state')).toContainText('Session only');
  await setInterfaceLanguage(page, 'tr');
  await expect(page.getByRole('button', { name: 'Dışa aktar', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Çalışma alanın' })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('.project-card')).toContainText('Atlas');
  await expect(page.locator('.project-card')).toContainText('Travel app');
  await page.getByRole('button', { name: 'Projeyi aç: Atlas', exact: true }).click();
  await expect(page.locator('.layer-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('exports real opaque PNGs and a locale-specific ZIP', async ({ page }) => {
  await page.goto('/');
  await openStudio(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Current panel', exact: true }).click();
  const png = await pngEvent;
  const bytes = await fs.readFile((await png.path())!);
  expect(bytes.readUInt32BE(16)).toBe(1206);
  expect(bytes.readUInt32BE(20)).toBe(2622);
  expect(bytes[25]).toBe(2); // PNG truecolor RGB, no alpha channel.
  await page.getByRole('button', { name: 'Current language', exact: true }).click();
  const outputChecks = page.locator('.export-output-list input');
  await page.getByRole('button', { name: 'Clear', exact: true }).last().click();
  await outputChecks.first().check();
  const zipEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Create ZIP', exact: true }).click();
  const download = await zipEvent;
  const zip = await JSZip.loadAsync(await fs.readFile((await download.path())!));
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
  expect(manifest.locales).toEqual(['en-US']);
  expect(manifest.outputs[0].pages).toBe(6);
  expect(zip.file(/\.png$/)).toHaveLength(6);
});

test('rejects invalid project files without changing the active project', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1,"documents":[],"copy":{}}'),
  });
  await expect(page.getByRole('alert')).toContainText('Could not import');
  await expect(page.locator('.project-card')).toHaveCount(1);
});

test('remains usable at a narrow viewport and traps dialog focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openStudio(page);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await expect(page.locator('.left-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('restores embedded images and removes the stored copy when saving is disabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(1);
  const project = await page.evaluate(async () => {
    const modulePath = '/src/defaultProject.ts';
    const { createDefaultProject } = await import(modulePath);
    const project = createDefaultProject();
    project.name = 'Portable image';
    project.notes = 'Image survives relaunch';
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff3366';
    context.fillRect(0, 0, 20, 20);
    project.documents[0].background = {
      ...project.documents[0].background,
      type: 'image',
      imageSrc: canvas.toDataURL(),
    };
    return project;
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'portable.vibescreens.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel('Project name')).toHaveValue('Portable image');
  await expect(page.locator('.save-state')).toContainText('Session only');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Save on this device').click();
  await expect(page.getByLabel('Save on this device')).toBeChecked();
  await expect(page.locator('.project-card.current')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('.project-card')).toHaveCount(1);
  const src = await page.evaluate(async () => {
    const modulePath = '/src/storage.ts';
    const { loadLibrary } = await import(modulePath);
    return (await loadLibrary())[0].project.documents[0].background.imageSrc;
  });
  expect(src).toBe(project.documents[0].background.imageSrc);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Save on this device').click();
  await expect(page.getByLabel('Save on this device')).not.toBeChecked();
  await expect(page.locator('.project-card.current')).toContainText('Session only');
  await page.reload();
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('.project-card')).not.toContainText('Portable image');
});

test('renders every output preset at its exact opaque dimensions', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const defaultPath = '/src/defaultProject.ts';
    const exportPath = '/src/exporter.ts';
    const { createDefaultProject } = await import(defaultPath);
    const { renderPage } = await import(exportPath);
    const project = createDefaultProject();
    const result = [];
    for (const document of project.documents) {
      const canvas = await renderPage(project, document, 'tr', 0);
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data;
      result.push({
        id: document.presetId,
        width: canvas.width,
        height: canvas.height,
        expected: [document.width, document.height],
        alpha: pixels[3],
      });
      canvas.width = 1;
      canvas.height = 1;
    }
    return result;
  });
  expect(results).toHaveLength(15);
  for (const result of results) {
    expect([result.width, result.height], result.id).toEqual(result.expected);
    expect(result.alpha).toBe(255);
  }
});

test('cancels a bulk render cleanly', async ({ page }) => {
  // Hold a real frame decode so cancellation happens during rendering rather
  // than racing a completed ZIP on fast machines.
  let releaseFrames!: () => void;
  const heldFrames = new Promise<void>((resolve) => {
    releaseFrames = resolve;
  });
  await page.route('**/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      route.request().resourceType() === 'image' &&
      (path.includes('/assets/devices/') || path.includes('/.local/legacy-device-artwork/'))
    )
      await heldFrames;
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  await page.getByRole('button', { name: 'Create ZIP', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  releaseFrames();
  await expect(page.getByRole('button', { name: 'Create ZIP', exact: true })).toBeEnabled();
  await expect(page.locator('.progress-card')).toHaveCount(0);
  await expect(page.locator('.warning-card')).toHaveCount(0);
});

test('handles cancellation during ZIP packing without an unhandled error or download', async ({ page }) => {
  const errors: string[] = [];
  const downloads: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.goto('/');
  const outcome = await page.evaluate(async () => {
    const projectPath = '/src/defaultProject.ts';
    const exportPath = '/src/exporter.ts';
    const { createDefaultProject } = await import(projectPath);
    const { exportProjectZip } = await import(exportPath);
    const project = createDefaultProject();
    project.documents[0].pageCount = 1;
    const controller = new AbortController();
    try {
      await exportProjectZip(project, {
        localeCodes: ['en-US'],
        documentIds: [project.documents[0].id],
        signal: controller.signal,
        onProgress: (_done: number, _total: number, label: string) => {
          if (label === 'ZIP') setTimeout(() => controller.abort(), 0);
        },
      });
      return 'completed';
    } catch (error) {
      return (error as Error).name;
    }
  });
  expect(outcome).toBe('AbortError');
  expect(errors).toEqual([]);
  expect(downloads).toEqual([]);
});

test('uses full-resolution device artwork and preserves uploaded screenshots in exports', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const devicesPath = '/src/devices.ts';
    const projectPath = '/src/defaultProject.ts';
    const exportPath = '/src/exporter.ts';
    const { DEVICES, getDeviceColor, DEVICE_ARTWORK_KIND } = await import(devicesPath);
    const { createDefaultProject } = await import(projectPath);
    const { renderPage } = await import(exportPath);
    const dimensions = [];
    for (const device of DEVICES.filter((d: { renderMode?: string }) => !d.renderMode)) {
      for (const color of device.colors) {
        const image = new Image();
        image.src = color.src;
        await image.decode();
        dimensions.push({
          valid: image.naturalWidth === device.frameWidth && image.naturalHeight === device.frameHeight,
        });
      }
    }
    const project = createDefaultProject();
    const document = project.documents[0];
    const device = DEVICES[0];
    const screenshot = window.document.createElement('canvas');
    screenshot.width = 30;
    screenshot.height = 60;
    const ctx = screenshot.getContext('2d')!;
    ctx.fillStyle = '#e44288';
    ctx.fillRect(0, 0, 30, 60);
    const layer = document.layers.find((l: { type: string }) => l.type === 'device');
    layer.screenSrc = screenshot.toDataURL();
    layer.rotation = 0;
    layer.x = 150;
    layer.y = 500;
    layer.width = 675;
    layer.height = 1380;
    document.layers = [layer];
    const canvas = await renderPage(project, document, 'en-US', 0);
    const pixel = Array.from(
      canvas
        .getContext('2d')
        .getImageData(
          layer.x + (device.screenX + device.screenWidth / 2) / 2,
          layer.y + (device.screenY + device.screenHeight / 2) / 2,
          1,
          1,
        ).data,
    );
    return { dimensions, pixel, kind: DEVICE_ARTWORK_KIND, src: getDeviceColor(device, 'black').src };
  });
  expect(result.dimensions).toHaveLength(23);
  expect(result.dimensions.every((item) => item.valid)).toBe(true);
  expect(result.src).toMatch(result.kind === 'photographic' ? /\.png(?:\?|$)/ : /\.svg(?:\?|$)/);
  expect(result.pixel).toEqual([228, 66, 136, 255]);
});

test('keeps the tent screen upright in both perspective views with opaque, seam-free content', async ({
  page,
}) => {
  await page.goto('/');
  const pixels = await page.evaluate(async () => {
    const renderPath = '/src/duoHalfFold.ts',
      devicePath = '/src/devices.ts',
      geometryPath = '/src/tentGeometry.ts';
    const { createHalfFoldedDeviceCanvas } = await import(renderPath);
    const { getDevice, getDeviceColor } = await import(devicePath);
    const { getTentScene } = await import(geometryPath);
    const frame = new Image();
    frame.src = getDeviceColor(getDevice('iphone-duo-outer-open'), 'night-sky').src;
    await frame.decode();
    const source = document.createElement('canvas');
    source.width = 2034;
    source.height = 1398;
    const ctx = source.getContext('2d')!;
    for (const [x, y, color] of [
      [0, 0, '#ff0000'],
      [1017, 0, '#00ff00'],
      [0, 699, '#0000ff'],
      [1017, 699, '#ffff00'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1017, 699);
    }
    const screen = new Image();
    screen.src = source.toDataURL();
    await screen.decode();
    const output = [];
    for (const direction of ['toward', 'away']) {
      const scene = getTentScene(90, direction);
      const canvas = createHalfFoldedDeviceCanvas(
        screen,
        frame,
        'cover',
        'night-sky',
        'tent',
        90,
        direction,
        { width: 1100, height: (1100 * scene.height) / scene.width },
      );
      const context = canvas.getContext('2d')!;
      for (const [u, v] of [
        [-517, 342],
        [483, 342],
        [-517, 1042],
        [483, 1042],
      ]) {
        const point = scene.project(scene.surface('front', u, v));
        output.push(
          Array.from(
            context.getImageData(
              Math.round((point.x * canvas.width) / scene.width),
              Math.round((point.y * canvas.height) / scene.height),
              1,
              1,
            ).data,
          ),
        );
      }
      output.push(Array.from(context.getImageData(0, 0, 1, 1).data));
      canvas.width = 1;
      canvas.height = 1;
    }
    return output;
  });
  for (const offset of [0, 5]) {
    expect(pixels[offset][0]).toBeGreaterThan(220);
    expect(pixels[offset][1]).toBeLessThan(20);
    expect(pixels[offset + 1][1]).toBeGreaterThan(220);
    expect(pixels[offset + 1][0]).toBeLessThan(20);
    expect(pixels[offset + 2][2]).toBeGreaterThan(220);
    expect(pixels[offset + 2][0]).toBeLessThan(20);
    expect(pixels[offset + 3][0]).toBeGreaterThan(220);
    expect(pixels[offset + 3][1]).toBeGreaterThan(220);
    for (let i = 0; i < 4; i++) expect(pixels[offset + i][3]).toBe(255);
    expect(pixels[offset + 4][3]).toBe(0);
  }
});

test('imports old tent layouts at the new physical aspect ratio without moving the layer', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(1);
  const fixture = await page.evaluate(async () => {
    const p = '/src/defaultProject.ts',
      g = '/src/duoHalfFold.ts';
    const { createDefaultProject } = await import(p);
    const { getHalfFoldedCanvasSize } = await import(g);
    const project = createDefaultProject();
    const layer = project.documents[0].layers.find((l: { type: string }) => l.type === 'device');
    layer.deviceId = 'iphone-duo-folded-tent';
    layer.colorId = 'night-sky';
    layer.foldAngle = 90;
    layer.width = 900;
    layer.x = 140;
    layer.y = 650;
    const projected = 1528 * Math.sin(Math.PI / 4),
      depth = 1528 * Math.cos(Math.PI / 4) * 0.9;
    layer.height =
      (900 * Math.ceil(depth + projected * 0.22 + 219.4 + 164)) / Math.ceil(2194 + projected * 1.15 + 164);
    project.documents[0].layers = [layer];
    const size = getHalfFoldedCanvasSize('tent', 90);
    return { project, expectedHeight: (900 * size.height) / size.width };
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'legacy-tent.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture.project)),
  });
  await page.locator('.canvas-shell canvas').first().waitFor();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project file', exact: true }).click();
  const file = await event;
  const exported = JSON.parse(await fs.readFile((await file.path())!, 'utf8'));
  expect(exported.documents[0].layers[0]).toMatchObject({ x: 140, y: 650, width: 900, sceneVersion: 2 });
  expect(exported.documents[0].layers[0].height).toBeCloseTo(fixture.expectedHeight);
});
