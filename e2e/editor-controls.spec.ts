import { test, expect, type Page } from '@playwright/test';
import type Konva from 'konva';

test('reorders keys with buttons and dragging, deletes selected keys, and restores through undo and reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Name your project').fill('Controls persistence');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('button', { name: 'Localizations', exact: true }).click();
  const rows = page.locator('tbody tr');
  await page.getByLabel('Move key down shot_01_headline', { exact: true }).click();
  await expect(rows.first()).toHaveAttribute('data-copy-key', 'shot_01_body');
  await page.getByLabel('Drag key shot_02_headline', { exact: true }).dragTo(rows.first());
  await expect(rows.first()).toHaveAttribute('data-copy-key', 'shot_02_headline');
  await page.getByLabel('Select key shot_02_headline', { exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected (1)', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete selected', exact: true }).click();
  await expect(page.locator('[data-copy-key="shot_02_headline"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(rows.first()).toHaveAttribute('data-copy-key', 'shot_02_headline');
  await expect(page.locator('.save-state')).toContainText('Saved on this device');
  await page.reload();
  await page.getByRole('button', { name: 'Open project: Controls persistence', exact: true }).click();
  await page.getByRole('button', { name: 'Localizations', exact: true }).click();
  await expect(rows.first()).toHaveAttribute('data-copy-key', 'shot_02_headline');
});

test('screenshot reordering preserves the exact exported pixels of seam content and panel backgrounds', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const a = '/src/defaultProject.ts',
      b = '/src/editorActions.ts',
      c = '/src/exporter.ts';
    const { createDefaultProject } = await import(a),
      { moveScreenshot } = await import(b),
      { renderPage } = await import(c);
    const p = createDefaultProject(),
      d = p.documents[0],
      w = d.width;
    d.pageCount = 3;
    const image = (color: string) => {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 2, 2);
      return c.toDataURL();
    };
    d.background = {
      type: 'image',
      color: '#fff',
      color2: '#fff',
      angle: 0,
      imageSrc: image('#09a060'),
      pageImages: { '0': image('#f50030'), '1': image('#0055ef') },
    };
    d.layers = [
      {
        id: 'shared',
        name: 'Shared',
        type: 'shape',
        shape: 'rectangle',
        x: w - 200,
        y: 500,
        width: 400,
        height: 900,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fill: '#f7df00',
        stroke: '#000',
        strokeWidth: 0,
        cornerRadius: 0,
      },
    ];
    const render = async (doc: typeof d) => {
      const values = [];
      for (let i = 0; i < 3; i++) {
        const canvas = await renderPage(p, doc, 'en-US', i, 0.25);
        values.push(canvas.toDataURL());
        canvas.width = canvas.height = 1;
      }
      return values;
    };
    const before = await render(d),
      after = await render(moveScreenshot(d, 0, 2));
    return after.every((png: string, i: number) => png === before[[1, 2, 0][i]]);
  });
  expect(result).toBe(true);
});

test('groups shared layers and moves screenshots using buttons and a destination', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(page.locator('.layer-page-group')).toHaveCount(6);
  await page.getByRole('button', { name: 'Move screenshot right 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Screenshot 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByLabel('Move screenshot to', { exact: true }).selectOption({ value: '4' });
  await expect(page.getByRole('button', { name: 'Screenshot 5', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.locator('.screenshot-item').nth(4).dragTo(page.locator('.screenshot-item').nth(0));
  await expect(page.getByRole('button', { name: 'Screenshot 1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

async function shapeFixture(page: Page) {
  await page.goto('/');
  const fixture = await page.evaluate(async () => {
    const a = '/src/defaultProject.ts';
    const { createDefaultProject } = await import(a);
    const p = createDefaultProject(),
      d = p.documents[0];
    d.pageCount = 1;
    d.layers = [
      {
        id: 'a',
        name: 'A',
        type: 'shape',
        shape: 'rectangle',
        x: 170,
        y: 700,
        width: 300,
        height: 160,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fill: '#f30',
        stroke: '#000',
        strokeWidth: 0,
        cornerRadius: 0,
      },
      {
        id: 'b',
        name: 'B',
        type: 'shape',
        shape: 'rectangle',
        x: 650,
        y: 1100,
        width: 400,
        height: 220,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fill: '#09e',
        stroke: '#000',
        strokeWidth: 0,
        cornerRadius: 0,
      },
    ];
    return p;
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.locator('.canvas-shell canvas').first().waitFor();
}

test('shows center guides during dragging and size matching while resizing without exporting guides', async ({
  page,
}) => {
  await shapeFixture(page);
  await page.getByRole('button', { name: 'A', exact: true }).click();
  const geometry = await page.evaluate(() => {
    const K = (window as unknown as { Konva: typeof Konva }).Konva;
    const stage = K.stages[0],
      node = stage.findOne('#node-a')!;
    const r = stage.container().getBoundingClientRect();
    const pos = node.getAbsolutePosition();
    return { x: r.left + pos.x + 20, y: r.top + pos.y + 15, zoom: stage.scaleX() };
  });
  await page.mouse.move(geometry.x, geometry.y);
  await page.mouse.down();
  await page.mouse.move(geometry.x + (453 - 170) * geometry.zoom, geometry.y + 2, { steps: 10 });
  const guideCount = () =>
    page.evaluate(() => {
      const K = (window as unknown as { Konva: typeof Konva }).Konva;
      return (K.stages[0].findOne('.smart-guides') as Konva.Group).getChildren().length;
    });
  await expect.poll(guideCount).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(guideCount).toBe(0);
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('453');
  const point = await page.evaluate(() => {
    const K = (window as unknown as { Konva: typeof Konva }).Konva,
      s = K.stages[0],
      tr = s.findOne('Transformer') as Konva.Transformer,
      a = tr.findOne('.bottom-right')!,
      r = s.container().getBoundingClientRect(),
      p = a.getAbsolutePosition();
    return { x: r.left + p.x, y: r.top + p.y, zoom: s.scaleX() };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 99 * point.zoom, point.y, { steps: 8 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const K = (window as unknown as { Konva: typeof Konva }).Konva;
        return (K.stages[0].findOne('.smart-guides') as Konva.Group)
          .find('Text')
          .some((n) => (n as Konva.Text).text().startsWith('W = 400'));
      }),
    )
    .toBe(true);
  await page.mouse.up();
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('400');
  await page.getByRole('button', { name: 'Smart guides', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Smart guides', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('accepts image files dropped on the canvas and directly on a device screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await page.locator('.canvas-shell canvas').first().waitFor();
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 10;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 20, 10);
    return c.toDataURL();
  });
  const transfer = await page.evaluateHandle(async (src) => {
    const blob = await (await fetch(src)).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'dropped.png', { type: 'image/png' }));
    return dt;
  }, image);
  const point = await page.evaluate(() => {
    const K = (window as unknown as { Konva: typeof Konva }).Konva,
      s = K.stages[0],
      r = s.container().getBoundingClientRect();
    return { x: r.left + s.x() + 10, y: r.top + s.y() + 10 };
  });
  await page
    .locator('.canvas-scroll')
    .dispatchEvent('drop', { dataTransfer: transfer, clientX: point.x, clientY: point.y });
  await expect(page.locator('.layer-row.selected .layer-name')).toHaveText('dropped');
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('820.08');
  await page.getByRole('button', { name: 'Phone · 6.3″', exact: true }).first().click();
  const center = await page.evaluate(() => {
    const K = (window as unknown as { Konva: typeof Konva }).Konva,
      s = K.stages[0],
      node = s.find('.selection-hit-area').find((n) => n.getParent()?.id().startsWith('node-device'))!,
      b = node.getClientRect(),
      r = s.container().getBoundingClientRect();
    return { x: r.left + b.x + b.width / 2, y: r.top + b.y + 30 };
  });
  await page
    .locator('.canvas-scroll')
    .dispatchEvent('drop', { dataTransfer: transfer, clientX: center.x, clientY: center.y });
  await expect(page.locator('.layer-row.selected .layer-name')).toHaveText('Phone · 6.3″');
});

test('crops the complete device, resets non-destructively, and switches to landscape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Phone · 6.3″', exact: true }).first().click();
  const width = Number(await page.getByLabel('Width', { exact: true }).inputValue()),
    height = Number(await page.getByLabel('Height', { exact: true }).inputValue());
  await page.getByLabel('Device orientation', { exact: true }).selectOption('landscape');
  await expect
    .poll(async () => Number(await page.getByLabel('Width', { exact: true }).inputValue()))
    .toBeCloseTo(height, 1);
  await page.getByRole('button', { name: 'Crop device', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Apply crop', exact: true })).toBeEnabled();
  const regionBox = await dialog.locator('.crop-region').boundingBox();
  await page.mouse.move(regionBox!.x + regionBox!.width - 2, regionBox!.y + regionBox!.height - 2);
  await page.mouse.down();
  await page.mouse.move(regionBox!.x + regionBox!.width * 0.8, regionBox!.y + regionBox!.height * 0.8, {
    steps: 6,
  });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await dialog.getByLabel('Crop width', { exact: true }).inputValue()))
    .toBeLessThan(100);
  await dialog.getByLabel('Crop width', { exact: true }).fill('50');
  await dialog.getByLabel('Crop height', { exact: true }).fill('60');
  await dialog.getByLabel('Crop x', { exact: true }).fill('20');
  await dialog.getByLabel('Crop y', { exact: true }).fill('10');
  await dialog.getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByLabel('Width', { exact: true }).inputValue()))
    .toBeCloseTo(height * 0.5, 1);
  await expect
    .poll(async () => Number(await page.getByLabel('Height', { exact: true }).inputValue()))
    .toBeCloseTo(width * 0.6, 1);
  await page.getByRole('button', { name: 'Reset crop', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByLabel('Width', { exact: true }).inputValue()))
    .toBeCloseTo(height, 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset crop', exact: true })).toBeVisible();
});

test('exports landscape screenshots upright and crops the casing and screen as one image', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const a = '/src/defaultProject.ts',
      b = '/src/devices.ts',
      c = '/src/deviceLayout.ts',
      e = '/src/exporter.ts';
    const { createDefaultProject } = await import(a),
      { getDevice } = await import(b),
      { cropDevice, deviceLayout } = await import(c),
      { renderLayerPreview } = await import(e);
    const p = createDefaultProject(),
      base = p.documents[0].layers.find((l: { type: string }) => l.type === 'device');
    const image = document.createElement('canvas');
    image.width = 200;
    image.height = 100;
    const ctx = image.getContext('2d')!;
    for (const [x, y, color] of [
      [0, 0, '#ff0000'],
      [100, 0, '#00ff00'],
      [0, 50, '#0000ff'],
      [100, 50, '#ffff00'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 100, 50);
    }
    const device = getDevice(base.deviceId);
    const layer = {
      ...base,
      orientation: 'landscape',
      width: device.frameHeight * 0.3,
      height: device.frameWidth * 0.3,
      screenSrc: image.toDataURL(),
      screenFit: 'fill',
    };
    const load = async (src: string) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      return canvas;
    };
    const full = await load(await renderLayerPreview(p, layer, 'en-US')),
      layout = deviceLayout(layer, device),
      s = layout.screen;
    const pixel = (x: number, y: number) =>
      Array.from(full.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    const colors = [
      pixel(s.x + s.width * 0.25, s.y + s.height * 0.25),
      pixel(s.x + s.width * 0.75, s.y + s.height * 0.25),
      pixel(s.x + s.width * 0.25, s.y + s.height * 0.75),
      pixel(s.x + s.width * 0.75, s.y + s.height * 0.75),
    ];
    const cropped = cropDevice(layer, { x: 0.2, y: 0.2, width: 0.5, height: 0.5 });
    const cut = await load(await renderLayerPreview(p, cropped, 'en-US'));
    const center = Array.from(
      cut.getContext('2d')!.getImageData(Math.round(cut.width * 0.5), Math.round(cut.height * 0.5), 1, 1)
        .data,
    );
    return {
      colors,
      center,
      expectedCenter: pixel(layer.width * 0.45, layer.height * 0.45),
      width: cut.width,
      expectedWidth: Math.round(layer.width * 0.5),
    };
  });
  expect(result.colors).toEqual([
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ]);
  expect(result.center).toEqual(result.expectedCenter);
  expect(result.width).toBe(result.expectedWidth);
});
