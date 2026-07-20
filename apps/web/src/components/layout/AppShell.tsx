"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { isProtectedRoute } from "@/server/auth/protected-routes";

const navItems = [
  { href: "/dashboard", label: "训练主页" },
  { href: "/workspace", label: "今日训练" },
  { href: "/history", label: "训练记录" },
  { href: "/settings", label: "账户设置" }
];

type AppShellUser = {
  id: string;
  email?: string | null;
};

export function AppShell({
  children,
  user
}: {
  children: ReactNode;
  user?: AppShellUser | null;
}) {
  const pathname = usePathname() ?? "/";
  const showProtectedNavigation =
    user === undefined ? isProtectedRoute(pathname) : Boolean(user);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href={showProtectedNavigation ? "/dashboard" : "/"}
            className="font-semibold"
          >
            结构化思维训练场
          </Link>
          {showProtectedNavigation ? (
            <>
              <nav aria-label="主导航" className="flex gap-4 text-sm">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <LogoutButton />
            </>
          ) : (
            <nav aria-label="公开导航" className="flex items-center gap-4 text-sm">
              <Link href="/training-demo">体验演示</Link>
              <Link
                href="/login"
                className="rounded-md bg-focus px-3 py-2 font-medium text-white"
              >
                登录
              </Link>
            </nav>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
