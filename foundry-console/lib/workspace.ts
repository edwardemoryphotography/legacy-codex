import { notFound } from "next/navigation";

const ADMIN_ROLES = new Set(["admin", "owner"]);

function normalizeRole(role: unknown) {
  if (typeof role !== "string") {
    return "";
  }

  return role.trim().toLowerCase();
}

export function isAdminRole(role: unknown) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

export async function requireWorkspaceAccess({
  supabase,
  userId,
  workspaceId,
}: {
  supabase: any;
  userId: string;
  workspaceId: string;
}) {
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    notFound();
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError) {
    throw workspaceError;
  }

  if (!workspace) {
    notFound();
  }

  return {
    membership,
    workspace,
    isAdmin: isAdminRole(membership.role),
  };
}
