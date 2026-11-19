import { openStudio, setInterfaceLanguage } from './desktop-test-utils.mjs';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    locale: 'en-US',
  });
  const svg = await fs.readFile('public/brand/icon.svg', 'utf8');
  await page.setContent(
    `<style>body{margin:0;background:transparent}img{width:1024px;height:1024px;display:block}</style><img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`,
  );
  await page.locator('img').screenshot({ path: 'public/brand/icon.png', omitBackground: true });
  await page.goto(process.env.VIBE_PREVIEW_URL ?? 'http://127.0.0.1:5179/');
  await page.getByRole('heading', { name: 'Your workspace' }).waitFor();
  await page.evaluate(async () => {
    const { createDefaultProject } = await import('/src/defaultProject.ts');
    const { saveEntry } = await import('/src/storage.ts');
    const a = createDefaultProject();
    a.name = 'Learnly';
    a.notes = 'A clearer way to learn. App Store launch · EN / TR';
    const b = createDefaultProject();
    b.name = 'Still';
    b.notes = 'A little more focus, every day. A new space to begin.';
    b.documents = b.documents.map((d) => ({
      ...d,
      background: { ...d.background, color: '#f6f0f9', color2: '#e1d8ec' },
    }));
    b.copy.shot_01_headline = { 'en-US': 'Make room for what matters', tr: 'Önemli olanlara yer aç' };
    b.copy.shot_01_body = {
      'en-US': 'A quieter place to find your focus.',
      tr: 'Odaklanmak için daha sakin bir alan.',
    };
    await saveEntry({ id: 'preview-learnly', project: a, persisted: true });
    await saveEntry({ id: 'preview-still', project: b, persisted: true });
    localStorage.setItem('vibe:active-project', 'preview-learnly');
  });
  await page.reload();
  await page.locator('.project-preview img').nth(5).waitFor();
  await page.screenshot({ path: 'docs/workspace.png' });
  await openStudio(page);
  await page.locator('.canvas-shell canvas').first().waitFor();
  await page.screenshot({ path: 'docs/studio.png' });
  await setInterfaceLanguage(page, 'tr');
  await page.screenshot({ path: 'docs/studio-tr.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/mobile.png' });
  await page.goto('http://127.0.0.1:5179/scripts/duo-render-check.html');
  await page.waitForFunction(() => !document.querySelector('#results')?.textContent?.includes('Running'), {
    timeout: 60000,
  });
  console.log(await page.locator('#results').innerText());
  await page.screenshot({ path: 'docs/fold-render-check.png', fullPage: true });
} finally {
  await browser.close();
}
