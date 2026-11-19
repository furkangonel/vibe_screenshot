import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-desktop-'));
const executablePath = process.env.VIBE_PACKAGED_EXECUTABLE;
async function launch() {
  return electron.launch({
    ...(executablePath ? { executablePath, args: [] } : { args: ['.'] }),
    env: { ...process.env, VIBE_DEV_URL: '', VIBE_PROFILE_DIR: profile, VIBE_HIDE_TEST_WINDOW: '1' },
  });
}
let app;
try {
  app = await launch();
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: /Your workspace|Çalışma alanın/ })).toBeVisible();
  await page.getByLabel(/Interface language|Arayüz dili/).selectOption('en');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Name your project').fill('Desktop smoke');
  await page.getByRole('dialog').getByLabel('Project notes').fill('Saved from a sandboxed desktop renderer.');
  await page.getByRole('dialog').getByLabel('Start with example layouts').uncheck();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.locator('.save-state')).toContainText('Saved on this device');
  await page.locator('.canvas-shell canvas').first().waitFor();
  await page.getByRole('button', { name: 'Device', exact: true }).click();
  await page.getByRole('menuitem', { name: /Foldable · Tent/ }).click();
  await expect(page.locator('.fold-controls')).toBeVisible();
  await expect(page.getByLabel('Selection dimensions')).toBeVisible();
  await page.getByRole('button', { name: 'Device', exact: true }).click();
  await page.getByRole('menuitem', { name: /Phone · 6.3/ }).click();
  await page.getByLabel('Device orientation', { exact: true }).selectOption('landscape');
  await page.getByRole('button', { name: 'Crop device', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Apply crop', exact: true }),
  ).toBeEnabled();
  await page.getByRole('dialog').getByLabel('Crop width', { exact: true }).fill('75');
  await page.getByRole('dialog').getByRole('button', { name: 'Apply crop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset crop', exact: true })).toBeVisible();
  const security = await app.evaluate(({ BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: prefs.sandbox,
      contextIsolation: prefs.contextIsolation,
      nodeIntegration: prefs.nodeIntegration,
    };
  });
  expect(security).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
  expect(page.url()).toBe('vibe://app/index.html');
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  expect(
    await page.evaluate(async () => {
      try {
        await fetch('https://example.com/');
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  // Verify CSP permits local vector frames and denies network connections.
  const frame = await page.evaluate(async () => {
    const img = new Image();
    img.src = 'vibe://app/assets/devices/iphone-18-pro/black.svg';
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
  expect(frame).toEqual({ width: 1350, height: 2760 });
  const photoFiles = (await fs.readdir('dist/assets')).filter((name) => name.endsWith('.png'));
  if (photoFiles.length) {
    const loaded = await page.evaluate(async (files) => {
      for (const file of files) {
        const image = new Image();
        image.src = `vibe://app/assets/${file}`;
        await image.decode();
        if (image.naturalWidth < 1000 || image.naturalHeight < 1000) return false;
      }
      return true;
    }, photoFiles);
    expect(loaded).toBe(true);
    console.log(`PASS: ${photoFiles.length} photographic device frames decode inside the packaged app.`);
  }

  await expect(page.locator('.save-state')).toContainText('Saved on this device');
  await page.screenshot({ path: 'docs/desktop.png' });
  await app.close();
  app = await launch();
  const reopened = await app.firstWindow();
  await expect(reopened.locator('.project-card')).toHaveCount(1);
  await expect(reopened.locator('.project-card')).toContainText('Desktop smoke');
  await expect(reopened.locator('.project-card')).toContainText('sandboxed desktop');
  await reopened.getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(reopened.locator('.layer-row')).toHaveCount(2);
  await expect(reopened.locator('.layer-name').filter({ hasText: 'Foldable · Tent' })).toHaveCount(1);
  await reopened.getByRole('button', { name: 'Phone · 6.3″', exact: true }).click();
  await expect(reopened.getByLabel('Device orientation', { exact: true })).toHaveValue('landscape');
  await expect(reopened.getByRole('button', { name: 'Reset crop', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log('PASS: desktop startup, sandbox, secure origin, local frames, project save and relaunch.');
} finally {
  if (app) await app.close();
  await fs.rm(profile, { recursive: true, force: true });
}
