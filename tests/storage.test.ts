import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createDefaultProject } from '../src/defaultProject';
import { deleteEntry, loadLibrary, saveEntry } from '../src/storage';
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});
it('keeps independent projects and embedded image data across database connections', async () => {
  const a = { id: 'a', project: createDefaultProject(), persisted: true };
  a.project.notes = 'Launch notes';
  a.project.documents[0].background.imageSrc = 'data:image/png;base64,aGVsbG8=';
  const b = { id: 'b', project: { ...createDefaultProject(), name: 'Second app' }, persisted: true };
  await saveEntry(a);
  await saveEntry(b);
  const saved = await loadLibrary();
  expect(saved).toEqual([a, b]);
  await deleteEntry('a');
  expect(await loadLibrary()).toEqual([b]);
});
it('serializes pending writes before deletion', async () => {
  const entry = { id: 'a', project: createDefaultProject(), persisted: true };
  await Promise.all([
    saveEntry(entry),
    saveEntry({ ...entry, project: { ...entry.project, name: 'Edited' } }),
    deleteEntry('a'),
  ]);
  expect(await loadLibrary()).toEqual([]);
});
it('migrates a previous single-project database exactly once', async () => {
  const project = createDefaultProject();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('vibe-screenshots-db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(project, 'current-project');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  const first = await loadLibrary();
  const second = await loadLibrary();
  expect(first).toHaveLength(1);
  expect(first[0].project).toEqual(project);
  expect(first[0].persisted).toBe(true);
  expect(second).toEqual(first);
});
