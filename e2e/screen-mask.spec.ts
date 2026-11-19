import { expect, test } from '@playwright/test';
import type Konva from 'konva';

test('clips the foldable cover to its asymmetric corners in PNG exports', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const devicePath = '/src/devices.ts',
      projectPath = '/src/defaultProject.ts',
      exportPath = '/src/exporter.ts';
    const { getDevice, DEVICE_ARTWORK_KIND } = await import(devicePath);
    const { createDefaultProject } = await import(projectPath);
    const { renderPage } = await import(exportPath);
    const sample = document.createElement('canvas');
    sample.width = 8;
    sample.height = 8;
    sample.getContext('2d')!.fillStyle = '#ff2040';
    sample.getContext('2d')!.fillRect(0, 0, 8, 8);
    const screenshot = sample.toDataURL();
    const results = [];
    for (const id of ['iphone-duo-outer-closed', 'iphone-duo-outer-open'])
      for (const color of ['night-sky', 'star-white'])
        for (const uploaded of [false, true]) {
          const project = createDefaultProject(),
            doc = project.documents[0],
            device = getDevice(id);
          doc.background = { ...doc.background, type: 'solid', color: '#f5f7fb' };
          const layer = doc.layers.find((l: { type: string }) => l.type === 'device');
          const scale = id.endsWith('closed') ? 0.5 : 0.3;
          Object.assign(layer, {
            deviceId: id,
            colorId: color,
            x: 80,
            y: 180,
            width: device.frameWidth * scale,
            height: device.frameHeight * scale,
            rotation: 0,
            screenSrc: uploaded ? screenshot : '',
            screenFit: 'cover',
          });
          doc.layers = [layer];
          const canvas = await renderPage(project, doc, 'en-US', 0),
            ctx = canvas.getContext('2d')!;
          const read = (x: number, y: number) =>
            Array.from(ctx.getImageData(Math.round(80 + x * scale), Math.round(180 + y * scale), 1, 1).data);
          results.push({
            id,
            artwork: DEVICE_ARTWORK_KIND,
            color,
            uploaded,
            top: read(device.screenX + device.screenWidth - 11, device.screenY + 10),
            bottom: read(device.screenX + device.screenWidth - 11, device.screenY + device.screenHeight - 10),
            center: read(device.screenX + device.screenWidth / 2, device.screenY + device.screenHeight / 2),
          });
          canvas.width = 1;
          canvas.height = 1;
        }
    return results;
  });
  expect(results).toHaveLength(8);
  for (const result of results) {
    if (result.artwork === 'photographic') {
      expect(result.top, `${result.id}/${result.color}/${result.uploaded}: top right`).toEqual([
        245, 247, 251, 255,
      ]);
      expect(result.bottom, `${result.id}/${result.color}/${result.uploaded}: bottom right`).toEqual([
        245, 247, 251, 255,
      ]);
    } else {
      // Original vector shells have a visible metal bezel here; photographic
      // shells expose the artboard. Neither may leak uploaded screen pixels.
      expect(result.top).not.toEqual([255, 32, 64, 255]);
      expect(result.bottom).not.toEqual([255, 32, 64, 255]);
      const peer = results.find((r) => r.id === result.id && r.color === result.color && !r.uploaded)!;
      expect(result.top).toEqual(peer.top);
      expect(result.bottom).toEqual(peer.bottom);
    }
    expect(result.center).not.toEqual([245, 247, 251, 255]);
    if (result.uploaded) expect(result.center).toEqual([255, 32, 64, 255]);
  }
});

test('uses the same asymmetric screen mask in the interactive canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(1);
  const fixture = await page.evaluate(async () => {
    const p = '/src/defaultProject.ts';
    const { createDefaultProject } = await import(p);
    const project = createDefaultProject(),
      doc = project.documents[0];
    project.name = 'Screen mask regression';
    doc.pageCount = 1;
    doc.background = { ...doc.background, type: 'solid', color: '#f5f7fb' };
    const layer = doc.layers.find((l: { type: string }) => l.type === 'device');
    Object.assign(layer, {
      deviceId: 'iphone-duo-outer-closed',
      colorId: 'night-sky',
      x: 80,
      y: 180,
      width: 787,
      height: 1097,
      rotation: 0,
      screenSrc: (() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#ff2040';
        context.fillRect(0, 0, 8, 8);
        return canvas.toDataURL();
      })(),
    });
    doc.layers = [layer];
    return project;
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'corners.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.locator('.canvas-shell canvas').first().waitFor();
  await page.waitForFunction(() => {
    const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
    return runtime?.stages[0]?.find('Image').some((node) => {
      const img = (node as Konva.Image).image();
      return img instanceof HTMLImageElement && img.complete;
    });
  });
  const pixels = await page.evaluate(() => {
    const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
    const stage = runtime.stages[0];
    stage.draw();
    const canvas = stage.getLayers()[0].getCanvas()._canvas;
    const ratio = canvas.width / stage.width();
    const read = (x: number, y: number) =>
      Array.from(
        canvas
          .getContext('2d')!
          .getImageData(
            Math.round((stage.x() + x * stage.scaleX()) * ratio),
            Math.round((stage.y() + y * stage.scaleY()) * ratio),
            1,
            1,
          ).data,
      );
    return [read(80 + 1475 / 2, 180 + 90 / 2), read(80 + 1475 / 2, 180 + 2104 / 2)];
  });
  for (const pixel of pixels) expect(pixel).not.toEqual([255, 32, 64, 255]);
});
