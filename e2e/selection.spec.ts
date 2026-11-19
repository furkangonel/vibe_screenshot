import { openStudio } from './ui';
import { expect, test } from '@playwright/test';
import type Konva from 'konva';

test('keeps selection handles small at 8%, 22% and 50% zoom', async ({ page }) => {
  await page.goto('/');
  await openStudio(page);
  await page.getByRole('button', { name: 'Headline 01', exact: true }).click();
  await expect(page.getByLabel('Selection dimensions')).toBeVisible();
  const zoom = page.locator('.zoom-control input');
  for (const value of [0.08, 0.22, 0.5]) {
    await zoom.focus();
    await page.keyboard.press(value === 0.5 ? 'End' : 'Home');
    if (value === 0.22) for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
    await expect(zoom).toHaveValue(String(value));
    const metrics = await page.evaluate(() => {
      const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
      const transformer = runtime.stages[0].findOne('Transformer') as Konva.Transformer;
      const handle = transformer.findOne('.top-left') as Konva.Rect;
      const rotation = transformer.findOne('.rotater') as Konva.Rect;
      return {
        width: handle.getClientRect({ skipShadow: true }).width,
        height: handle.getClientRect({ skipShadow: true }).height,
        rotationWidth: rotation.getClientRect({ skipShadow: true }).width,
        border: transformer.borderStrokeWidth(),
        rotationTop: rotation.getClientRect().y,
      };
    });
    expect(metrics.width).toBeGreaterThan(6);
    expect(metrics.width).toBeLessThan(10);
    expect(metrics.height).toBeGreaterThan(6);
    expect(metrics.height).toBeLessThan(10);
    expect(metrics.rotationWidth).toBeLessThan(11);
    expect(metrics.border).toBeLessThan(1.5);
    expect(metrics.rotationTop).toBeGreaterThanOrEqual(0);
  }
});

test('resizes with the small handle, updates dimensions live and disables controls when locked', async ({
  page,
}) => {
  await page.goto('/');
  await openStudio(page);
  const row = page
    .locator('.layer-row')
    .filter({ has: page.getByRole('button', { name: 'Headline 01', exact: true }) })
    .first();
  await row.getByRole('button', { name: 'Headline 01', exact: true }).click();
  const badge = page.getByLabel('Selection dimensions');
  await expect(badge).toBeVisible();
  const before = await badge.innerText();
  const initialWidth = Number(await page.getByLabel('Width', { exact: true }).inputValue());
  const point = await page.evaluate(() => {
    const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
    const transformer = runtime.stages[0].findOne('Transformer') as Konva.Transformer;
    const anchor = transformer.findOne('.bottom-right')!;
    const position = anchor.getAbsolutePosition(),
      rect = runtime.stages[0].container().getBoundingClientRect();
    return { x: rect.left + position.x, y: rect.top + position.y };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 44, point.y + 22, { steps: 8 });
  await expect(badge).not.toHaveText(before);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.getByLabel('Width', { exact: true }).inputValue()))
    .toBeGreaterThan(initialWidth + 100);
  await row.getByRole('button', { name: 'Lock layer', exact: true }).click();
  await expect(page.getByLabel('Locked layer')).toBeVisible();
  const visible = await page.evaluate(() => {
    const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
    const transformer = runtime.stages[0].findOne('Transformer') as Konva.Transformer;
    return transformer.find('._anchor').filter((node) => node.isVisible()).length;
  });
  expect(visible).toBe(0);
  await row.getByRole('button', { name: 'Hide layer', exact: true }).click();
  await expect(page.locator('.selection-badge')).toHaveCount(0);
});

test('uses four corner handles for devices and preserves their proportions', async ({ page }) => {
  await page.goto('/');
  await openStudio(page);
  await page.getByRole('button', { name: 'Phone · 6.3″', exact: true }).last().click();
  await expect(page.getByLabel('Selection dimensions')).toBeVisible();
  const result = await page.evaluate(() => {
    const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
    const transformer = runtime.stages[0].findOne('Transformer') as Konva.Transformer;
    const bottom = transformer.findOne('.bottom-right')!.getClientRect();
    return {
      anchors: transformer.enabledAnchors(),
      keepRatio: transformer.keepRatio(),
      canvasHeight: runtime.stages[0].height(),
      bottom: bottom.y + bottom.height,
    };
  });
  expect(result.anchors).toEqual(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
  expect(result.keepRatio).toBe(true);
  expect(result.bottom).toBeLessThanOrEqual(result.canvasHeight);
});

test('selects a device directly on the canvas after clearing the selection', async ({ page }) => {
  await page.goto('/');
  await openStudio(page);
  await page.locator('.canvas-shell canvas').first().waitFor();
  const points = await page.evaluate(() => {
    const runtime = (window as unknown as { Konva: typeof Konva }).Konva;
    const stage = runtime.stages[0],
      container = stage.container().getBoundingClientRect();
    const node = stage.find('.selection-hit-area')[0];
    const box = node.getClientRect();
    return {
      empty: { x: container.left + stage.x() + 8, y: container.top + stage.y() + 8 },
      device: { x: container.left + box.x + box.width / 2, y: container.top + box.y + 30 },
    };
  });
  await page.mouse.click(points.empty.x, points.empty.y);
  await expect(page.locator('.selection-badge')).toHaveCount(0);
  await page.mouse.click(points.device.x, points.device.y);
  await expect(page.getByLabel('Selection dimensions')).toBeVisible();
  await expect(page.locator('.layer-row.selected .layer-name')).toHaveText('Phone · 6.3″');
});
