import { openStudio, setInterfaceLanguage } from './ui';
import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

test('existing projects add Android canvases on demand without losing previous work', async ({ page }) => {
  await page.goto('/');
  const legacy = await page.evaluate(async () => {
    const modulePath = '/src/defaultProject.ts';
    const { createDefaultProject } = await import(modulePath);
    const project = createDefaultProject();
    project.name = 'Existing Android upgrade check';
    project.documents = project.documents.filter(
      (d: { presetId: string }) => !d.presetId.startsWith('android-'),
    );
    project.notes = 'Preserve images, translation keys and layout IDs';
    return project;
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'existing-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  const output = page.getByRole('combobox', { name: 'Output', exact: true });
  await output.selectOption('new:android-tablet-7-portrait');
  await expect(page.getByRole('spinbutton', { name: /^Screenshot count/ })).toHaveValue('1');
  await page.getByRole('spinbutton', { name: /^Screenshot count/ }).fill('9');
  await expect(page.getByRole('spinbutton', { name: /^Screenshot count/ })).toHaveValue('8');
  await page.getByRole('button', { name: 'Device', exact: true }).click();
  await page.getByRole('menuitem', { name: /Android Tablet · 7″/ }).click();
  await expect(page.getByRole('combobox', { name: 'Device', exact: true })).toHaveValue('android-tablet-7');
  await page.getByLabel('Device orientation', { exact: true }).selectOption('landscape');
  await page.getByRole('combobox', { name: 'Finish', exact: true }).selectOption('silver');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Save on this device').click();
  await openStudio(page);
  await expect(page.locator('.save-state')).toContainText('Saved on this device');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project file', exact: true }).click();
  const file = await downloadEvent;
  const saved = JSON.parse(await fs.readFile((await file.path())!, 'utf8'));
  expect(saved.documents.slice(0, 9)).toEqual(legacy.documents);
  expect(saved.copy).toEqual(legacy.copy);
  expect(saved.notes).toBe(legacy.notes);
  expect(saved.documents).toHaveLength(10);
  expect(saved.documents[9]).toMatchObject({
    presetId: 'android-tablet-7-portrait',
    width: 1440,
    height: 2560,
    pageCount: 8,
  });
  expect(saved.documents[9].layers[0]).toMatchObject({
    deviceId: 'android-tablet-7',
    colorId: 'silver',
    orientation: 'landscape',
  });
  await page.reload();
  await openStudio(page);
  await output.selectOption({ label: 'Android Tablet 7″ · Portrait' });
  await expect(page.getByRole('spinbutton', { name: /^Screenshot count/ })).toHaveValue('8');
  await expect(output.locator('option[value="new:android-tablet-7-portrait"]')).toHaveCount(0);
});

test('all Android finishes decode and preserve exact screen colors in full-resolution PNG renders', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const devicePath = '/src/devices.ts',
      projectPath = '/src/defaultProject.ts',
      exportPath = '/src/exporter.ts';
    const { DEVICES } = await import(devicePath);
    const { createDefaultProject } = await import(projectPath);
    const { renderPage } = await import(exportPath);
    const sample = document.createElement('canvas');
    sample.width = sample.height = 8;
    const ctx = sample.getContext('2d')!;
    ctx.fillStyle = '#ef4056';
    ctx.fillRect(0, 0, 8, 8);
    const screen = sample.toDataURL();
    const decoded = [];
    const renders = [];
    const sheet = document.createElement('canvas');
    sheet.width = 1500;
    sheet.height = 1000;
    const sheetContext = sheet.getContext('2d')!;
    sheetContext.fillStyle = '#eef1f5';
    sheetContext.fillRect(0, 0, 1500, 1000);
    let index = 0;
    for (const device of DEVICES.filter((d: { platform?: string }) => d.platform === 'android')) {
      for (const color of device.colors) {
        const image = new Image();
        image.src = color.src;
        await image.decode();
        decoded.push({
          id: device.id,
          color: color.id,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      }
      for (const orientation of ['portrait', 'landscape']) {
        const project = createDefaultProject();
        const doc = project.documents.find(
          (d: { presetId: string }) => d.presetId === `${device.id}-${orientation}`,
        )!;
        doc.pageCount = 1;
        const layer = doc.layers.find((l: { type: string }) => l.type === 'device');
        layer.screenSrc = screen;
        doc.layers = [layer];
        const canvas = await renderPage(project, doc, 'en-US', 0);
        const context = canvas.getContext('2d')!;
        renders.push({
          id: device.id,
          orientation,
          width: canvas.width,
          height: canvas.height,
          center: Array.from(
            context.getImageData(
              Math.round(layer.x + layer.width / 2),
              Math.round(layer.y + layer.height / 2),
              1,
              1,
            ).data,
          ),
        });
        if (orientation === 'portrait') {
          const frame = new Image();
          frame.src = device.colors[0].src;
          await frame.decode();
          const slot = index++;
          const frameWidth = 330,
            frameHeight = (frameWidth * device.frameHeight) / device.frameWidth;
          const x = slot * 500 + (500 - frameWidth) / 2,
            y = (930 - frameHeight) / 2;
          sheetContext.fillStyle = '#172033';
          sheetContext.font = '600 23px system-ui';
          sheetContext.textAlign = 'center';
          sheetContext.fillText(device.label, slot * 500 + 250, 55);
          sheetContext.fillStyle = '#ef4056';
          sheetContext.fillRect(
            x + (device.screenX / device.frameWidth) * frameWidth,
            y + (device.screenY / device.frameHeight) * frameHeight,
            (device.screenWidth / device.frameWidth) * frameWidth,
            (device.screenHeight / device.frameHeight) * frameHeight,
          );
          sheetContext.drawImage(frame, x, y, frameWidth, frameHeight);
        }
        canvas.width = canvas.height = 1;
      }
    }
    return { decoded, renders, preview: sheet.toDataURL().split(',')[1] };
  });
  expect(result.decoded).toHaveLength(7);
  expect(result.renders).toHaveLength(6);
  for (const render of result.renders) {
    expect(render.center, `${render.id}/${render.orientation}`).toEqual([239, 64, 86, 255]);
    const portrait = render.orientation === 'portrait';
    const sizes = {
      'android-phone': [1080, 1920],
      'android-tablet-7': [1440, 2560],
      'android-tablet-10': [2160, 3840],
    };
    const [width, height] = sizes[render.id as keyof typeof sizes];
    expect([render.width, render.height]).toEqual(portrait ? [width, height] : [height, width]);
  }
  await fs.writeFile('docs/android-devices.png', Buffer.from(result.preview, 'base64'));
});

test('Google Play page controls remain available in Turkish', async ({ page }) => {
  await page.goto('/');
  await openStudio(page);
  await setInterfaceLanguage(page, 'tr');
  await page
    .getByRole('combobox', { name: 'Çıktı', exact: true })
    .selectOption({ label: 'Android Telefon · Dikey' });
  await expect(page.locator('.rule-badge')).toHaveText('Google Play boyutu');
  await expect(page.locator('.inspector input[type="number"]').first()).toHaveAttribute('max', '8');
});
