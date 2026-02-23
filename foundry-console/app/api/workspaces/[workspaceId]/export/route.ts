import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function fetchTable({
  supabase,
  table,
  workspaceId,
}: {
  supabase: any;
  table: string;
  workspaceId: string;
}) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message },
      { status: 500 },
    );
  }

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [sprints, frictionEntries, milestones, events] = await Promise.all([
      fetchTable({ supabase, table: "sprints", workspaceId }),
      fetchTable({ supabase, table: "friction_entries", workspaceId }),
      fetchTable({ supabase, table: "milestones", workspaceId }),
      fetchTable({ supabase, table: "events", workspaceId }),
    ]);

    const body = JSON.stringify(
      {
        workspace_id: workspaceId,
        exported_at: new Date().toISOString(),
        sprints,
        friction_entries: frictionEntries,
        milestones,
        events,
      },
      null,
      2,
    );

    const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `workspace-${safeWorkspaceId}-export.json`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Export generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
