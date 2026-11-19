import type { Page } from '@playwright/test';
export async function openStudio(page: Page) {
  await page.locator('.project-cover, .view-tabs button').first().waitFor();
  const current = page.locator('.project-card.current .project-cover');
  if (await current.isVisible()) await current.click();
  else if (await page.locator('.project-cover').first().isVisible())
    await page.locator('.project-cover').first().click();
  else await page.getByRole('button', { name: /^(Studio|Stüdyo)$/ }).click();
}
export async function setInterfaceLanguage(page: Page, language: 'en' | 'tr') {
  await page.getByRole('button', { name: /^(Settings|Ayarlar)$/ }).click();
  await page.getByLabel(/^(Settings language|Ayarlar dili)$/).selectOption(language);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Close|Kapat)$/ })
    .click();
}
