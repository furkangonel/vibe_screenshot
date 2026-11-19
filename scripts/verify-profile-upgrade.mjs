import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const [profile, oldExecutable, newExecutable, reportPath] = process.argv.slice(2);
async function inspect(executablePath, android) {
  const app = await electron.launch({
    executablePath,
    args: [],
    env: { ...process.env, VIBE_DEV_URL: '', VIBE_PROFILE_DIR: profile, VIBE_HIDE_TEST_WINDOW: '1' },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.project-card').first()).toBeVisible();
    const entries = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('vibe-screenshots-db', 2);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const rows = await new Promise((resolve, reject) => {
        const r = db.transaction('library', 'readonly').objectStore('library').getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          name: row.project.name,
          documents: row.project.documents.length,
          hash: Array.from(
            new Uint8Array(
              await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(row))),
            ),
          )
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        })),
      );
    });
    if (android) {
      await page.getByRole('button', { name: /Studio|Stüdyo/, exact: true }).click();
      await expect(page.locator('option[value="new:android-phone-portrait"]')).toHaveCount(1);
      await expect(page.locator('option[value="new:android-tablet-7-portrait"]')).toHaveCount(1);
      await expect(page.locator('option[value="new:android-tablet-10-portrait"]')).toHaveCount(1);
      const decoded = await page.evaluate(async () => {
        const paths = [
          'android-phone/graphite',
          'android-phone/silver',
          'android-phone/sage',
          'android-tablet-7/graphite',
          'android-tablet-7/silver',
          'android-tablet-10/graphite',
          'android-tablet-10/silver',
        ];
        for (const path of paths) {
          const image = new Image();
          image.src = `vibe://app/assets/devices/${path}.svg`;
          await image.decode();
        }
        return paths.length;
      });
      expect(decoded).toBe(7);
    }
    return entries.sort((a, b) => a.id.localeCompare(b.id));
  } finally {
    await app.close();
  }
}
const before = await inspect(oldExecutable, false);
const after = await inspect(newExecutable, true);
expect(after).toEqual(before);
await fs.writeFile(
  reportPath,
  JSON.stringify(
    {
      passed: true,
      projects: after,
      compared: 'SHA-256 of complete stored project entries including images and translations',
    },
    null,
    2,
  ),
);
console.log(
  `PASS: ${after.length} existing projects are byte-for-byte identical; all 7 Android frames decode in the packaged app.`,
);
console.log(after.map((p) => `${p.name}: ${p.documents} outputs`).join('\n'));
