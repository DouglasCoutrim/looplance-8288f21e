import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type SimMode = "real" | "admin_arena" | "player";

interface RoleSimulatorState {
  mode: SimMode;
  simulatedArenaId: string | null;
  setMode: (m: SimMode) => void;
  setSimulatedArenaId: (id: string | null) => void;
  reset: () => void;
}

const Ctx = createContext<RoleSimulatorState | null>(null);
const STORAGE_KEY = "role-sim";

export function RoleSimulatorProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SimMode>("real");
  const [simulatedArenaId, setArenaIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.mode) setModeState(parsed.mode);
        if (parsed.simulatedArenaId) setArenaIdState(parsed.simulatedArenaId);
      }
    } catch {}
  }, []);

  function persist(next: { mode: SimMode; simulatedArenaId: string | null }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  const setMode = (m: SimMode) => {
    setModeState(m);
    persist({ mode: m, simulatedArenaId });
  };
  const setSimulatedArenaId = (id: string | null) => {
    setArenaIdState(id);
    persist({ mode, simulatedArenaId: id });
  };
  const reset = () => {
    setModeState("real");
    setArenaIdState(null);
    persist({ mode: "real", simulatedArenaId: null });
  };

  return (
    <Ctx.Provider value={{ mode, simulatedArenaId, setMode, setSimulatedArenaId, reset }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRoleSimulator(): RoleSimulatorState {
  const v = useContext(Ctx);
  if (!v) return { mode: "real", simulatedArenaId: null, setMode: () => {}, setSimulatedArenaId: () => {}, reset: () => {} };
  return v;
}
