"use client";

import { WorkspaceProvider } from "@/lib/workspace-context";
import { ToastProvider } from "@/components/toast";
import { DashboardShell } from "@/components/dashboard-shell";
import { AuthGate } from "@/components/auth-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <ToastProvider>
        <WorkspaceProvider>
          <DashboardShell>{children}</DashboardShell>
        </WorkspaceProvider>
      </ToastProvider>
    </AuthGate>
  );
}
