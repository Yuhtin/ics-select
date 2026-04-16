import { create } from 'zustand';

export type CameraMode = 'follow' | 'focus';

export interface SceneState {
  cameraMode: CameraMode;
  focusedNodeId: string | null;
  nearestNodeId: string | null;
  keys: Record<string, boolean>;
  setMode: (mode: CameraMode) => void;
  setFocusedNode: (id: string | null) => void;
  setNearestNode: (id: string | null) => void;
  setKey: (key: string, pressed: boolean) => void;
  reset: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  cameraMode: 'follow',
  focusedNodeId: null,
  nearestNodeId: null,
  keys: {},
  setMode: (mode) => set({ cameraMode: mode }),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  setNearestNode: (id) => set({ nearestNodeId: id }),
  setKey: (key, pressed) =>
    set((s) => ({ keys: { ...s.keys, [key.toLowerCase()]: pressed } })),
  reset: () => set({ cameraMode: 'follow', focusedNodeId: null, nearestNodeId: null, keys: {} }),
}));
