import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createDefaultProject } from './defaultProject';
import { createId } from './id';
import { migrateProject } from './projectMigration';
import { parseProject } from './projectValidation';
import {
  deleteEntry,
  loadLibrary,
  readPreference,
  saveEntry,
  writePreference,
  type ProjectEntry,
} from './storage';
import type { ScreenshotProject } from './types';

type State = {
  entries: ProjectEntry[];
  activeId: string;
  past: ScreenshotProject[];
  future: ScreenshotProject[];
};
type Action =
  | { type: 'load'; entries: ProjectEntry[]; activeId: string }
  | {
      type: 'update';
      update: ScreenshotProject | ((p: ScreenshotProject) => ScreenshotProject);
      now: string;
      id?: string;
    }
  | { type: 'switch'; id: string }
  | { type: 'add'; entry: ProjectEntry }
  | { type: 'saved'; id: string; persisted: boolean }
  | { type: 'delete'; id: string }
  | { type: 'undo' | 'redo' };
export function workspaceReducer(state: State, action: Action): State {
  const active = state.entries.find(
    (entry) => entry.id === (action.type === 'update' && action.id ? action.id : state.activeId),
  );
  if (action.type === 'load') return { ...state, entries: action.entries, activeId: action.activeId };
  if (action.type === 'switch') return { ...state, activeId: action.id, past: [], future: [] };
  if (action.type === 'add')
    return {
      ...state,
      entries: [...state.entries, action.entry],
      activeId: action.entry.id,
      past: [],
      future: [],
    };
  if (action.type === 'saved')
    return {
      ...state,
      entries: state.entries.map((e) => (e.id === action.id ? { ...e, persisted: action.persisted } : e)),
    };
  if (action.type === 'delete')
    return {
      ...state,
      entries: state.entries.filter((e) => e.id !== action.id),
      activeId:
        state.activeId === action.id
          ? (state.entries.find((e) => e.id !== action.id)?.id ?? '')
          : state.activeId,
      past: [],
      future: [],
    };
  if (!active) return state;
  let project = active.project;
  let past = state.past;
  let future = state.future;
  if (action.type === 'update') {
    project = typeof action.update === 'function' ? action.update(project) : action.update;
    if (project === active.project) return state;
    project = { ...project, updatedAt: action.now };
    if (active.id === state.activeId) {
      past = [...past.slice(-49), active.project];
      future = [];
    }
  } else if (action.type === 'undo' && past.length) {
    project = past[past.length - 1];
    past = past.slice(0, -1);
    future = [active.project, ...future];
  } else if (action.type === 'redo' && future.length) {
    project = future[0];
    future = future.slice(1);
    past = [...past, active.project];
  } else return state;
  return {
    ...state,
    past,
    future,
    entries: state.entries.map((e) => (e.id === active.id ? { ...e, project } : e)),
  };
}
const initial: State = { entries: [], activeId: '', past: [], future: [] };
export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, initial);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const saved = useRef(new Map<string, ScreenshotProject>());
  const removing = useRef(new Set<string>());
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    let live = true;
    loadLibrary()
      .then((entries) => {
        if (!live) return;
        const valid = entries.map((e) => ({
          ...e,
          project: migrateProject(parseProject(e.project)),
          persisted: true,
        }));
        for (const e of valid) saved.current.set(e.id, e.project);
        const next = valid.length
          ? valid
          : [{ id: createId('project'), project: createDefaultProject(), persisted: false }];
        const activeId = readPreference('active-project');
        dispatch({
          type: 'load',
          entries: next,
          activeId: next.find((e) => e.id === activeId)?.id ?? next[0].id,
        });
      })
      .catch(() => {
        if (!live) return;
        setStatus('error');
        setError('storageUnavailable');
        const entry = { id: createId('project'), project: createDefaultProject(), persisted: false };
        dispatch({ type: 'load', entries: [entry], activeId: entry.id });
      });
    return () => {
      live = false;
    };
  }, []);
  const flushing = useRef<Promise<boolean> | null>(null);
  const flush = useCallback(() => {
    if (flushing.current) return flushing.current;
    flushing.current = Promise.resolve()
      .then(async () => {
        try {
          // An undo may restore a previously saved object while an older write is
          // still in flight. Keep draining until disk matches the current library.
          while (true) {
            const dirty = stateRef.current.entries.filter(
              (e) => e.persisted && !removing.current.has(e.id) && saved.current.get(e.id) !== e.project,
            );
            if (!dirty.length) {
              setStatus('saved');
              return true;
            }
            setStatus('saving');
            for (const entry of dirty) {
              await saveEntry(entry);
              saved.current.set(entry.id, entry.project);
            }
          }
        } catch {
          setStatus('error');
          setError('saveFailed');
          return false;
        }
      })
      .finally(() => {
        flushing.current = null;
      });
    return flushing.current;
  }, []);

  useEffect(() => {
    if (
      !state.entries.some(
        (e) => e.persisted && !removing.current.has(e.id) && saved.current.get(e.id) !== e.project,
      )
    ) {
      // Undo can cancel a debounced change before any write starts.
      if (!flushing.current) setStatus('saved');
      return;
    }
    setStatus('saving');
    const timer = window.setTimeout(() => {
      void flush();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [state.entries, flush]);
  useEffect(() => {
    if (state.activeId) writePreference('active-project', state.activeId);
  }, [state.activeId]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (
        stateRef.current.entries.some(
          (e) => e.persisted && !removing.current.has(e.id) && saved.current.get(e.id) !== e.project,
        )
      ) {
        void flush();
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [flush]);
  const setProject = useCallback(
    (update: ScreenshotProject | ((p: ScreenshotProject) => ScreenshotProject)) =>
      dispatch({ type: 'update', update, now: new Date().toISOString() }),
    [],
  );
  async function addProject(project: ScreenshotProject, persisted: boolean) {
    const entry = { id: createId('project'), project, persisted };
    if (persisted) {
      try {
        await saveEntry(entry);
        saved.current.set(entry.id, project);
      } catch {
        setError('saveFailed');
        return null;
      }
    }
    dispatch({ type: 'add', entry });
    return entry.id;
  }
  function add(project: ScreenshotProject) {
    dispatch({ type: 'add', entry: { id: createId('project'), project, persisted: false } });
  }
  async function persist(enabled: boolean) {
    const entry = state.entries.find((e) => e.id === state.activeId);
    if (!entry) return;
    try {
      if (enabled) {
        removing.current.delete(entry.id);
        await saveEntry(entry);
        saved.current.set(entry.id, entry.project);
      } else {
        removing.current.add(entry.id);
        await deleteEntry(entry.id);
        saved.current.delete(entry.id);
      }
      dispatch({ type: 'saved', id: entry.id, persisted: enabled });
      setStatus('saved');
    } catch {
      removing.current.delete(entry.id);
      setStatus('error');
      setError('saveFailed');
    }
  }
  async function remove(id: string) {
    try {
      removing.current.add(id);
      await deleteEntry(id);
      saved.current.delete(id);
      dispatch({ type: 'delete', id });
      if (state.entries.length === 1) add(createDefaultProject());
    } catch {
      removing.current.delete(id);
      setError('saveFailed');
    }
  }
  return {
    ...state,
    project: state.entries.find((e) => e.id === state.activeId)?.project ?? null,
    persisted: state.entries.find((e) => e.id === state.activeId)?.persisted ?? false,
    setProject,
    updateEntry: (id: string, project: ScreenshotProject) =>
      dispatch({ type: 'update', id, update: project, now: new Date().toISOString() }),
    add,
    addProject,
    persist,
    remove,
    flush,
    status,
    error,
    clearError: () => setError(''),
    switchProject: (id: string) => dispatch({ type: 'switch', id }),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
  };
}
