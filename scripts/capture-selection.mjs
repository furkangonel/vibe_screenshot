import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
    deviceScaleFactor: 1,
  });
  await page.goto(process.env.VIBE_PREVIEW_URL ?? 'http://127.0.0.1:5179/');
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Phone · 6.3″', exact: true }).last().click();
  await page.getByLabel('Selection dimensions').waitFor();
  await page.waitForFunction(() => {
    const transformer = window.Konva?.stages[0]?.findOne('Transformer');
    return transformer
      ?.nodes()[0]
      ?.find('Image')
      .some((node) => node.image() instanceof HTMLImageElement && node.image().complete);
  });
  await page.screenshot({ path: 'docs/selection-studio.png' });
  await page.locator('.workspace').screenshot({ path: 'docs/selection-device.png' });
  await page.getByRole('button', { name: 'Headline 01', exact: true }).click();
  await page.getByLabel('Selection dimensions').waitFor();
  await page.locator('.workspace').screenshot({ path: 'docs/selection-text.png' });
  await page.locator('.zoom-control input').focus();
  await page.keyboard.press('Home');
  await page.locator('.workspace').screenshot({ path: 'docs/selection-low-zoom.png' });
  console.log('Captured device/text selections and fixed-size handles at 8% zoom.');
} finally {
  await browser.close();
}
