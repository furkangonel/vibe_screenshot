import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../src/defaultProject';
import { migrateProject } from '../src/projectMigration';
import { parseProject, validateCopy, validateLocales } from '../src/projectValidation';
import { workspaceReducer } from '../src/useWorkspace';
import { messages, translate } from '../src/i18n';

describe('portable project validation', () => {
  it('round-trips the complete starter project', () => {
    const project = createDefaultProject();
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it.each([
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents = [];
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents[0].pageCount = 1.5;
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents[0].layers[0].width = NaN;
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents[0].presetId = 'unknown';
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents[0].width = 1;
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents[0].layers.push(p.documents[0].layers[0]);
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.documents[0].background.imageSrc = 'https://example.com/tracking.png';
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.defaultLocale = 'unknown';
    },
    (p: ReturnType<typeof createDefaultProject>) => {
      p.updatedAt = 'not-a-date';
    },
  ])('rejects malformed projects before they reach the editor (%#)', (mutate) => {
    const p = createDefaultProject();
    mutate(p);
    expect(() => parseProject(p)).toThrow('Invalid project');
  });
  it('rejects unsafe keys and invalid localization cells', () => {
    expect(() => validateCopy(JSON.parse('{"__proto__":{"en-US":"pollution"}}'))).toThrow();
    expect(() => validateCopy({ headline: { tr: 42 } })).toThrow();
    expect(() => validateLocales([{ code: '../folder', name: 'Invalid' }])).toThrow();
    expect(() =>
      validateLocales([
        { code: 'tr', name: 'Türkçe' },
        { code: 'tr', name: 'Duplicate' },
      ]),
    ).toThrow();
  });
  it('migrates the legacy foldable canvas without losing text overrides', () => {
    const p = createDefaultProject();
    const d = p.documents[0];
    p.documents = [{ ...d, presetId: 'duo-inner-portrait', width: 2007, height: 2853 }];
    const next = migrateProject(parseProject(p));
    expect(next.documents[0]).toMatchObject({ presetId: 'iphone-duo-portrait', width: 1398, height: 2034 });
    expect(next.documents[0].layers).toHaveLength(d.layers.length);
    expect(parseProject(next)).toBe(next);
  });
});

describe('project editing history', () => {
  const entry = (id: string) => ({ id, project: createDefaultProject(), persisted: true });
  it('undoes and redoes changes, isolates projects, and clears redo after a new edit', () => {
    const a = entry('a');
    const b = entry('b');
    const initial = { entries: [a, b], activeId: 'a', past: [], future: [] };
    const changed = workspaceReducer(initial, {
      type: 'update',
      update: (p) => ({ ...p, name: 'Launch A' }),
      now: new Date().toISOString(),
    });
    expect(changed.entries[1]).toBe(b);
    const undone = workspaceReducer(changed, { type: 'undo' });
    expect(undone.entries[0].project).toBe(a.project);
    expect(workspaceReducer(undone, { type: 'redo' }).entries[0].project.name).toBe('Launch A');
    expect(
      workspaceReducer(undone, {
        type: 'update',
        update: (p) => ({ ...p, name: 'Another edit' }),
        now: new Date().toISOString(),
      }).future,
    ).toEqual([]);
    expect(workspaceReducer(changed, { type: 'switch', id: 'b' }).past).toEqual([]);
    expect(a.project.name).not.toBe('Launch A');
  });
  it('bounds retained history and preserves the chosen save preference', () => {
    let state = {
      entries: [entry('a')],
      activeId: 'a',
      past: [] as ReturnType<typeof createDefaultProject>[],
      future: [] as ReturnType<typeof createDefaultProject>[],
    };
    for (let i = 0; i < 75; i++)
      state = workspaceReducer(state, {
        type: 'update',
        update: (p) => ({ ...p, name: String(i) }),
        now: new Date().toISOString(),
      });
    expect(state.past).toHaveLength(50);
    expect(workspaceReducer(state, { type: 'saved', id: 'a', persisted: false }).entries[0].persisted).toBe(
      false,
    );
  });
});

it('ships complete English and Turkish pairs', () => {
  for (const [key, pair] of Object.entries(messages)) {
    expect(pair).toHaveLength(2);
    expect(pair[0].trim()).not.toBe('');
    expect(pair[1].trim()).not.toBe('');
    expect(translate('en', key)).toBe(pair[0]);
    expect(translate('tr', key)).toBe(pair[1]);
  }
});
