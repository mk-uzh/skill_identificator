"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PROJECT, parseProject, type ProjectId } from "./project";
import { getDevelopers } from "./study-config";
import type { Developer } from "./types";

const KEY = "devskill.project";

interface ProjectState {
  project: ProjectId;
  setProject: (p: ProjectId) => void;
  developers: Developer[];
}

const ProjectContext = createContext<ProjectState>({
  project: DEFAULT_PROJECT,
  setProject: () => {},
  developers: getDevelopers(DEFAULT_PROJECT),
});

/**
 * The project the case study is run on. Kept in localStorage (not in the
 * session) so it survives starting a new session, and read after mount so
 * server and client render the same first frame.
 */
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setState] = useState<ProjectId>(DEFAULT_PROJECT);

  useEffect(() => {
    try {
      setState(parseProject(window.localStorage.getItem(KEY)));
    } catch {
      // storage can be blocked; the default project is fine then
    }
  }, []);

  const setProject = useCallback((p: ProjectId) => {
    setState(p);
    try {
      window.localStorage.setItem(KEY, p);
    } catch {
      // see above
    }
  }, []);

  const value = useMemo(
    () => ({ project, setProject, developers: getDevelopers(project) }),
    [project, setProject],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectState {
  return useContext(ProjectContext);
}
