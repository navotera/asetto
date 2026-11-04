import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * The active entity (company/PT) scopes list views — mirrors Akunta's workspace
 * switch, contextual to Asetto's entities. `null` means "Semua Entitas" (all).
 * Kept per-viewer in localStorage; it is a client-side convenience, so reads are
 * wrapped in try/catch and the app works fine without it.
 */
const KEY = 'asetto:active-entity';

interface ActiveEntityCtx {
  activeEntityId: string | null;
  setActiveEntityId: (id: string | null) => void;
}

const Ctx = createContext<ActiveEntityCtx>({ activeEntityId: null, setActiveEntityId: () => {} });

export function ActiveEntityProvider({ children }: { children: ReactNode }) {
  const [activeEntityId, setId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  const setActiveEntityId = useCallback((id: string | null) => {
    setId(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      // Private mode / blocked storage — selection stays in memory for this view.
    }
  }, []);

  return <Ctx.Provider value={{ activeEntityId, setActiveEntityId }}>{children}</Ctx.Provider>;
}

export const useActiveEntity = () => useContext(Ctx);
