"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { logEvent } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import type { Workspace } from "@/lib/types";

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; error: string };

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  setCurrent: (ws: Workspace) => void;
  createWorkspace: (name: string) => Promise<CreateWorkspaceResult>;
  loading: boolean;
  connectionError: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  current: null,
  setCurrent: () => {},
  createWorkspace: async () => ({
    ok: false,
    error: "Workspace creation is unavailable.",
  }),
  loading: true,
  connectionError: null,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrentState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .order("name");

      if (error) {
        setConnectionError(error.message);
        setLoading(false);
        return;
      }

      const ws = data ?? [];
      setWorkspaces(ws);
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem("foundry_workspace_id")
          : null;
      const match = ws.find((w: Workspace) => w.id === saved);
      setCurrentState(match || ws[0] || null);
      setLoading(false);
    }
    load();
  }, []);

  const setCurrent = useCallback((ws: Workspace) => {
    setCurrentState(ws);
    localStorage.setItem("foundry_workspace_id", ws.id);
  }, []);

  const createWorkspace = useCallback(
    async (name: string): Promise<CreateWorkspaceResult> => {
      try {
        const { data, error } = await createClient()
          .from("workspaces")
          .insert({ name })
          .select()
          .single();
        if (error) throw error;
        if (!data) throw new Error("Supabase returned no workspace row.");

        void logEvent(data.id, "workspace.created", "workspace", data.id, {
          name,
        });
        setWorkspaces((prev) =>
          [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
        );
        setCurrent(data);
        return { ok: true, workspace: data };
      } catch (error) {
        return { ok: false, error: getErrorMessage(error) };
      }
    },
    [setCurrent]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        current,
        setCurrent,
        createWorkspace,
        loading,
        connectionError,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
