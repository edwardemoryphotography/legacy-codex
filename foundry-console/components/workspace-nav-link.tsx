"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}
