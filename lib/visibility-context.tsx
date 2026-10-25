"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ORG_CONFIG,
  VISIBILITY_LABELS,
  type VisibilityMode,
} from "@/lib/org-config";

const STORAGE_KEY = "devskill.visibility";

interface VisibilityContextValue {
  visibility: VisibilityMode;
  setVisibility: (mode: VisibilityMode) => void;
  labels: typeof VISIBILITY_LABELS;
}

const VisibilityContext = createContext<VisibilityContextValue | null>(null);

export function VisibilityProvider({ children }: { children: ReactNode }) {
  const [visibility, setVisibilityState] = useState<VisibilityMode>(ORG_CONFIG.visibility);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY) as VisibilityMode | null;
      if (stored && stored in VISIBILITY_LABELS) {
        setVisibilityState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setVisibility = useCallback((mode: VisibilityMode) => {
    setVisibilityState(mode);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ visibility, setVisibility, labels: VISIBILITY_LABELS }),
    [visibility, setVisibility],
  );

  return (
    <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
  );
}

export function useVisibility(): VisibilityContextValue {
  const ctx = useContext(VisibilityContext);
  if (!ctx) {
    return {
      visibility: ORG_CONFIG.visibility,
      setVisibility: () => undefined,
      labels: VISIBILITY_LABELS,
    };
  }
  return ctx;
}
