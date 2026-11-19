import { openStudio } from './ui';
import { expect, test } from '@playwright/test';
test('returns home from a project and preserves independent sidebar preferences', async ({ page }) => {
  await page.goto('/');
  await openStudio(page);
  const left = page.getByRole('button', { name: 'Layers', exact: true });
  const right = page.getByRole('button', { name: 'Artboard', exact: true });
  await expect(left).toHaveAttribute('aria-expanded', 'true');
  await expect(right).toHaveAttribute('aria-expanded', 'true');
  await left.click();
  await expect(page.locator('.left-panel')).not.toBeVisible();
  await expect(page.locator('.right-panel')).toBeVisible();
  await right.click();
  await expect(page.locator('.right-panel')).not.toBeVisible();
  await left.click();
  await expect(page.locator('.left-panel')).toBeVisible();
  await expect(page.locator('.right-panel')).not.toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
  await page.reload();
  await openStudio(page);
  await expect(left).toHaveAttribute('aria-expanded', 'true');
  await expect(right).toHaveAttribute('aria-expanded', 'false');
});
test('opens native-style settings, edits precision preferences and explains desktop MCP in a browser', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Make room for your work' })).toBeVisible();
  await dialog.getByLabel('Snap distance', { exact: true }).fill('9');
  await dialog.getByRole('button', { name: 'Agent connections', exact: true }).click();
  await expect(dialog.getByText('Available in the desktop app', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'General', exact: true }).click();
  await dialog.getByLabel('Settings language').selectOption('tr');
  await expect(dialog.getByRole('heading', { name: 'Çalışmana yer aç' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await expect(page.getByLabel('Yakalama mesafesi', { exact: true })).toHaveValue('9');
});
