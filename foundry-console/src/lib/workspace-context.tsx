"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Workspace, WorkspaceMember } from "@/lib/types";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  memberships: WorkspaceMember[];
  current: Workspace | null;
  currentRole: "admin" | "member" | null;
  setCurrent: (ws: Workspace) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  memberships: [],
  current: null,
  currentRole: null,
  setCurrent: () => {},
  loading: true,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<WorkspaceMember[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: members } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("user_id", user.id);

      if (members && members.length > 0) {
        setMemberships(members);
        const wsIds = members.map((m: WorkspaceMember) => m.workspace_id);
        const { data: ws } = await supabase
          .from("workspaces")
          .select("*")
          .in("id", wsIds)
          .order("name");

        if (ws) {
          setWorkspaces(ws);
          const saved = localStorage.getItem("foundry_workspace_id");
          const match = ws.find((w: Workspace) => w.id === saved);
          setCurrent(match || ws[0] || null);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const currentRole =
    current && memberships.length > 0
      ? memberships.find((m) => m.workspace_id === current.id)?.role ?? null
      : null;

  function handleSetCurrent(ws: Workspace) {
    setCurrent(ws);
    localStorage.setItem("foundry_workspace_id", ws.id);
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        memberships,
        current,
        currentRole,
        setCurrent: handleSetCurrent,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
