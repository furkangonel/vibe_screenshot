import { useEffect, useRef } from 'react';
import { desktop } from './desktop';
import { applyAutomation, withoutImages } from './automation';
import { DEVICES } from './devices';
import { OUTPUT_PRESETS } from './presets';
import { DEFAULT_LOCALES } from './locales';
import { createDefaultProject } from './defaultProject';
import { parseProject } from './projectValidation';
import { migrateProject } from './projectMigration';
import { createProjectZip, renderPage } from './exporter';
import type { useWorkspace } from './useWorkspace';

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function useDesktopAutomation(workspace: ReturnType<typeof useWorkspace>, open: () => void) {
  const ref = useRef({ workspace, open });
  ref.current = { workspace, open };
  useEffect(
    () =>
      desktop?.onAutomation(async (method, args) => {
        const { workspace: ws, open } = ref.current;
        if (!ws.project) throw new Error('The studio is still loading. Try again.');
        if (method === 'app_status')
          return {
            activeProjectId: ws.activeId,
            saveState: ws.status,
            projectCount: ws.entries.length,
            origin: location.origin,
          };
        if (method === 'presets_list') return OUTPUT_PRESETS;
        if (method === 'devices_list')
          return DEVICES.map((d) => ({ ...d, colors: d.colors.map(({ id, label }) => ({ id, label })) }));
        if (method === 'locales_list') return DEFAULT_LOCALES;
        if (method === 'projects_list')
          return ws.entries.map((e) => ({
            id: e.id,
            name: e.project.name,
            saved: e.persisted,
            outputs: e.project.documents.length,
            languages: e.project.locales.map((l) => l.code),
            updatedAt: e.project.updatedAt,
          }));
        if (['history_undo', 'history_redo'].includes(method)) {
          if (!(method === 'history_undo' ? ws.past.length : ws.future.length))
            throw new Error('No matching history entry.');
          (method === 'history_undo' ? ws.undo : ws.redo)();
          await settle();
          await ref.current.workspace.flush();
          return { updated: true };
        }
        if (method === 'project_create' || method === 'project_import') {
          const project =
            method === 'project_import' ? migrateProject(parseProject(args.project)) : createDefaultProject();
          if (method === 'project_create') {
            project.name = String(args.name);
            project.defaultLocale = String(args.defaultLocale || 'en-US');
            if (args.examples !== true) {
              project.copy = {};
              project.documents = project.documents.map((d) => ({ ...d, layers: [], pageCount: 1 }));
            }
          }
          parseProject(project);
          const id = await ws.addProject(project, true);
          if (!id) throw new Error('Project could not be saved.');
          await settle();
          open();
          return { projectId: id };
        }
        const entry = ws.entries.find((e) => e.id === args.projectId);
        if (!entry) throw new Error('Project ID was not found. Call projects_list first.');
        const project = entry.project;
        if (method === 'project_get') return args.includeImages === true ? project : withoutImages(project);
        if (method === 'project_open') {
          ws.switchProject(entry.id);
          await settle();
          open();
          return { projectId: entry.id };
        }
        if (method === 'project_duplicate') {
          const id = await ws.addProject(
            { ...structuredClone(project), name: String(args.name), updatedAt: new Date().toISOString() },
            true,
          );
          if (!id) throw new Error('Project could not be saved.');
          return { projectId: id };
        }
        if (method === 'project_save') {
          if (!entry.persisted) throw new Error('Enable Save on this device in the app first.');
          await ws.flush();
          if (ref.current.workspace.status === 'error')
            throw new Error('Local save failed. Check the studio.');
          return { saved: true };
        }
        if (method === 'documents_list')
          return project.documents.map(({ layers, ...d }) => ({
            ...withoutImages(d),
            layerCount: layers.length,
          }));
        if (method === 'localizations_get')
          return {
            copy: project.copy,
            order: project.copyOrder,
            locales: project.locales,
            defaultLocale: project.defaultLocale,
          };
        if (method === 'export_project')
          return { name: project.name, base64: await base64(new Blob([JSON.stringify(project, null, 2)])) };
        if (method === 'export_zip') {
          const ids = args.documentIds as string[],
            locales = args.locales as string[];
          const count = project.documents
            .filter((d) => ids.includes(d.id))
            .reduce((n, d) => n + d.pageCount * locales.length, 0);
          if (count > 300)
            throw new Error('Export at most 300 screenshots per MCP call. Split the languages into batches.');
          return {
            name: project.name,
            base64: await base64(await createProjectZip(project, { documentIds: ids, localeCodes: locales })),
          };
        }
        const document = project.documents.find((d) => d.id === args.documentId);
        if (method === 'layers_list') {
          if (!document) throw new Error('Canvas ID was not found.');
          return withoutImages(document.layers);
        }
        if (method === 'preview_render' || method === 'export_png') {
          if (!document) throw new Error('Canvas ID was not found.');
          const ratio =
            method === 'preview_render' ? Math.min(1, 1200 / Math.max(document.width, document.height)) : 1;
          const canvas = await renderPage(
            project,
            document,
            String(args.locale),
            Number(args.page || 0),
            ratio,
          );
          const result = {
            name: `${project.name}-${document.presetId}-${Number(args.page || 0) + 1}-${args.locale}`,
            base64: canvas.toDataURL('image/png').split(',')[1],
            width: canvas.width,
            height: canvas.height,
          };
          canvas.width = canvas.height = 1;
          return result;
        }
        const changed = applyAutomation(project, method, args);
        ws.updateEntry(entry.id, changed.project);
        await settle();
        await ref.current.workspace.flush();
        if (ref.current.workspace.status === 'error')
          throw new Error('The edit is visible but could not be saved. Check the studio.');
        return { ...(changed.result as object), saved: entry.persisted };
      }),
    [],
  );
}
