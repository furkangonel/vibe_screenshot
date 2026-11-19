import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
const port = 5187,
  url = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'ignore' },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch {
      /* Wait for the isolated Vite server. */
    }
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error('Documentation server did not start.');
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    locale: 'en-US',
  });
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
  const sample = await page.evaluate(async () => {
    const demoPath = '/src/demoProject.ts',
      storagePath = '/src/storage.ts';
    const { createDemoProject } = await import(demoPath);
    const { saveEntry } = await import(storagePath);
    const project = createDemoProject();
    await saveEntry({ id: 'demo-daylight', project, persisted: true });
    localStorage.setItem('vibe:active-project', 'demo-daylight');
    return project;
  });
  await fs.mkdir('docs/images', { recursive: true });
  await fs.mkdir('examples', { recursive: true });
  await fs.writeFile('examples/daylight.vibescreens.json', JSON.stringify(sample, null, 2) + '\n');
  await page.reload();
  await expect(page.locator('.project-preview img')).toHaveCount(3);
  await page.screenshot({ path: 'docs/images/projects.png' });
  await page.getByRole('button', { name: 'Open project: Daylight', exact: true }).click();
  await page.locator('.canvas-shell canvas').first().waitFor();
  await page.waitForFunction(() => {
    const runtime = window.Konva;
    return runtime?.stages?.[0]?.find('Image').filter((n) => n.image()?.complete).length >= 3;
  });
  await page.screenshot({ path: 'docs/images/studio.png' });
  if (process.env.VIBE_CAPTURE_PANELS === '1') {
    for (const [name, left, right] of [
      ['both', true, true],
      ['left', true, false],
      ['none', false, false],
      ['right', false, true],
    ]) {
      for (const [label, wanted] of [
        ['Layers', left],
        ['Artboard', right],
      ]) {
        const toggle = page.getByRole('button', { name: label, exact: true });
        if ((await toggle.getAttribute('aria-expanded')) !== String(wanted)) await toggle.click();
      }
      await page.screenshot({ path: `docs/images/panels-${name}.png` });
      console.log(
        name,
        JSON.stringify({
          canvas: await page.locator('.canvas-scroll').boundingBox(),
          leftControl: await page.getByRole('button', { name: 'Layers', exact: true }).boundingBox(),
          rightControl: await page.getByRole('button', { name: 'Artboard', exact: true }).boundingBox(),
        }),
      );
    }
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    for (const width of [1024, 720, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: `docs/images/window-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.screenshot({ path: 'docs/images/preferences.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  // Screenshot an isolated, explicitly illustrative client setup. No local paths,
  // real clients, connection tokens, or personal configurations are inspected.
  await page.addInitScript(() => {
    const tools = [
      { name: 'projects_list', description: 'List the local project library.', readOnly: true },
      { name: 'layer_add', description: 'Add a text, device, image or shape layer.', readOnly: false },
    ];
    window.vibeDesktop = {
      platform: 'demo',
      status: async () => ({
        enabled: true,
        running: true,
        port: 37891,
        url: 'http://127.0.0.1:37891/mcp',
        error: '',
        exportsFolder: 'Local app exports',
        version: '2026.11.1',
        toolCount: 34,
        tools,
        recent: [],
      }),
      agents: async () =>
        ['Codex', 'Claude Code', 'Cursor', 'Claude Desktop', 'VS Code'].map((name, i) => ({
          id: String(i),
          name,
          path: 'Client configuration on this computer',
          detected: i < 3,
          connected: i === 0,
          error: '',
          preview: 'Illustrative setup — connect your own client in the desktop app.',
        })),
      onStatus: () => () => {},
      onNavigate: () => () => {},
      onAutomation: () => () => {},
      setMcp: async () => {
        throw new Error('Illustration only');
      },
      configureAgent: async () => {
        throw new Error('Illustration only');
      },
      showExports: async () => '',
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Agent connections', exact: true }).click();
  await expect(page.getByText('Running locally', { exact: true })).toBeVisible();
  await expect(page.locator('.agent-card')).toHaveCount(5);
  await page.screenshot({ path: 'docs/images/connections.png' });
  console.log(
    'Generated original Daylight demo and four clean documentation screenshots. Connection view is illustrative.',
  );
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
