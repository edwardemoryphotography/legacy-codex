"use client";

import { WorkspaceProvider } from "@/lib/workspace-context";
import { ToastProvider } from "@/components/toast";
import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceProvider>
    </ToastProvider>
  );
}
