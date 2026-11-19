// Only for disposable, isolated desktop test profiles. Never use with a user's app.
export async function closeTestApp(app) {
  let timeout;
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          app.process().kill();
          reject(new Error('The isolated desktop test app did not close within 15 seconds.'));
        }, 15_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function openStudio(page) {
  await page.locator('.project-cover, .view-tabs button').first().waitFor();
  const current = page.locator('.project-card.current .project-cover');
  if (await current.isVisible()) await current.click();
  else if (await page.locator('.project-cover').first().isVisible())
    await page.locator('.project-cover').first().click();
  else await page.getByRole('button', { name: /^(Studio|Stüdyo)$/ }).click();
}
export async function setInterfaceLanguage(page, language) {
  await page.getByRole('button', { name: /^(Settings|Ayarlar)$/ }).click();
  await page.getByLabel(/^(Settings language|Ayarlar dili)$/).selectOption(language);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Close|Kapat)$/ })
    .click();
}
